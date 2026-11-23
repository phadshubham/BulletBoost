import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db, engine, Base
from ..db_models import Project, ResumeDocument, BulletRevision, ProjectSnapshot
from ..models import (
    ProjectCreateRequest,
    ProjectUpdateRequest,
    ProjectSummary,
    ProjectDetail,
    BulletRevisionItem,
    SnapshotCreateRequest,
    UploadedResumeItem,
)

# Auto-create tables on import/startup
Base.metadata.create_all(bind=engine)

# Safe SQLite migration: ensure enhanced_bullets_json column exists
try:
    with engine.connect() as conn:
        cursor = conn.exec_driver_sql("PRAGMA table_info(resume_documents);")
        cols = [row[1] for row in cursor.fetchall()]
        if "enhanced_bullets_json" not in cols:
            conn.exec_driver_sql("ALTER TABLE resume_documents ADD COLUMN enhanced_bullets_json TEXT DEFAULT '[]';")
            conn.commit()
except Exception:
    pass

router = APIRouter(prefix="/api/projects", tags=["Project & Revision Memory"])


@router.get("/library/resumes", response_model=List[UploadedResumeItem])
def list_uploaded_resumes_endpoint(db: Session = Depends(get_db)):
    """List all uploaded/parsed base resumes in the library for direct reuse."""
    docs = db.query(ResumeDocument).order_by(ResumeDocument.created_at.desc()).all()
    seen_keys = set()
    library_items = []
    
    for doc in docs:
        if not doc.sections_json or doc.sections_json == "[]":
            continue
        sections = []
        try:
            sections = json.loads(doc.sections_json)
        except Exception:
            sections = []

        bullet_count = sum(len(s.get("bullets", [])) for s in sections)
        if not sections or bullet_count == 0:
            continue

        # Deduplicate identical resumes by filename and bullet count
        key = (doc.filename, bullet_count)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        library_items.append(
            UploadedResumeItem(
                id=doc.id,
                project_id=doc.project_id,
                filename=doc.filename,
                file_type=doc.file_type,
                bullet_count=bullet_count,
                section_count=len(sections),
                sections=sections,
                raw_text=doc.raw_text,
                created_at=doc.created_at.isoformat(),
            )
        )
    return library_items


@router.get("", response_model=List[ProjectSummary])
def list_projects_endpoint(db: Session = Depends(get_db)):
    """List all saved resume optimization projects with bullet counts and review stats."""
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    summaries = []
    for p in projects:
        bullet_count = 0
        accepted_count = 0
        rejected_count = 0
        pending_count = 0

        if p.documents:
            doc = p.documents[0]
            try:
                sections = json.loads(doc.sections_json)
                bullet_count = sum(len(s.get("bullets", [])) for s in sections)
            except Exception:
                bullet_count = 0

            try:
                eb_list = json.loads(doc.enhanced_bullets_json) if hasattr(doc, "enhanced_bullets_json") and doc.enhanced_bullets_json else []
                accepted_count = sum(1 for b in eb_list if b.get("status") == "accepted")
                rejected_count = sum(1 for b in eb_list if b.get("status") == "rejected")
                pending_count = sum(1 for b in eb_list if b.get("status") in {"pending", "review_needed"})
            except Exception:
                pass
        
        summaries.append(
            ProjectSummary(
                id=p.id,
                title=p.title,
                target_role=p.target_role,
                writing_style=p.writing_style,
                bullet_count=bullet_count,
                accepted_count=accepted_count,
                rejected_count=rejected_count,
                pending_count=pending_count,
                created_at=p.created_at.isoformat(),
                updated_at=p.updated_at.isoformat(),
            )
        )
    return summaries


@router.post("", response_model=ProjectDetail)
def create_project_endpoint(request: ProjectCreateRequest, db: Session = Depends(get_db)):
    """Create a new project session to store uploaded resume, JD, style, and bullets."""
    project = Project(
        title=request.title or "Untitled Resume",
        target_role=request.target_role or "",
        job_description=request.job_description or "",
        writing_style=request.writing_style or "achievement",
        supporting_facts=request.supporting_facts or "",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Attach document
    sections_json_str = json.dumps(request.sections or [])
    enhanced_bullets_json_str = json.dumps(request.enhanced_bullets or [])
    doc = ResumeDocument(
        project_id=project.id,
        filename=request.filename or "resume.txt",
        file_type="parsed",
        raw_text=request.raw_text or "",
        sections_json=sections_json_str,
        enhanced_bullets_json=enhanced_bullets_json_str,
    )
    db.add(doc)
    db.commit()
    db.refresh(project)

    return ProjectDetail(
        id=project.id,
        title=project.title,
        target_role=project.target_role,
        job_description=project.job_description,
        writing_style=project.writing_style,
        supporting_facts=project.supporting_facts,
        filename=doc.filename,
        raw_text=doc.raw_text,
        sections=request.sections or [],
        enhanced_bullets=request.enhanced_bullets or [],
        revisions=[],
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project_endpoint(project_id: str, db: Session = Depends(get_db)):
    """Retrieve full project state with sections, enhanced bullets, and revision history."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    filename = "resume.txt"
    raw_text = ""
    sections = []
    enhanced_bullets = []

    if project.documents:
        doc = project.documents[0]
        filename = doc.filename
        raw_text = doc.raw_text or ""
        try:
            sections = json.loads(doc.sections_json)
        except Exception:
            sections = []
        try:
            enhanced_bullets = json.loads(doc.enhanced_bullets_json) if hasattr(doc, "enhanced_bullets_json") and doc.enhanced_bullets_json else []
        except Exception:
            enhanced_bullets = []

    revisions = [
        BulletRevisionItem(
            id=r.id,
            bullet_id=r.bullet_id,
            section_title=r.section_title,
            original_text=r.original_text,
            current_text=r.current_text,
            status=r.status,
            decision_reason=r.decision_reason,
            ats_delta=r.ats_delta,
            variation_angle=r.variation_angle,
            created_at=r.created_at.isoformat(),
        )
        for r in project.revisions
    ]

    return ProjectDetail(
        id=project.id,
        title=project.title,
        target_role=project.target_role,
        job_description=project.job_description,
        writing_style=project.writing_style,
        supporting_facts=project.supporting_facts,
        filename=filename,
        raw_text=raw_text,
        sections=sections,
        enhanced_bullets=enhanced_bullets,
        revisions=revisions,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


@router.put("/{project_id}", response_model=ProjectDetail)
def update_project_endpoint(project_id: str, request: ProjectUpdateRequest, db: Session = Depends(get_db)):
    """Auto-save changes to target role, JD, writing style, supporting facts, sections, or enhanced bullets."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if request.title is not None:
        project.title = request.title
    if request.target_role is not None:
        project.target_role = request.target_role
    if request.job_description is not None:
        project.job_description = request.job_description
    if request.writing_style is not None:
        project.writing_style = request.writing_style
    if request.supporting_facts is not None:
        project.supporting_facts = request.supporting_facts

    sections = []
    enhanced_bullets = []
    filename = "resume.txt"
    raw_text = ""

    if project.documents:
        doc = project.documents[0]
        filename = doc.filename
        raw_text = doc.raw_text or ""
        if request.sections is not None:
            doc.sections_json = json.dumps(request.sections)
            sections = request.sections
        else:
            try:
                sections = json.loads(doc.sections_json)
            except Exception:
                sections = []

        if request.enhanced_bullets is not None:
            doc.enhanced_bullets_json = json.dumps(request.enhanced_bullets)
            enhanced_bullets = request.enhanced_bullets
        else:
            try:
                enhanced_bullets = json.loads(doc.enhanced_bullets_json) if hasattr(doc, "enhanced_bullets_json") and doc.enhanced_bullets_json else []
            except Exception:
                enhanced_bullets = []

    db.commit()
    db.refresh(project)

    revisions = [
        BulletRevisionItem(
            id=r.id,
            bullet_id=r.bullet_id,
            section_title=r.section_title,
            original_text=r.original_text,
            current_text=r.current_text,
            status=r.status,
            decision_reason=r.decision_reason,
            ats_delta=r.ats_delta,
            variation_angle=r.variation_angle,
            created_at=r.created_at.isoformat(),
        )
        for r in project.revisions
    ]

    return ProjectDetail(
        id=project.id,
        title=project.title,
        target_role=project.target_role,
        job_description=project.job_description,
        writing_style=project.writing_style,
        supporting_facts=project.supporting_facts,
        filename=filename,
        raw_text=raw_text,
        sections=sections,
        enhanced_bullets=enhanced_bullets,
        revisions=revisions,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


@router.delete("/{project_id}")
def delete_project_endpoint(project_id: str, db: Session = Depends(get_db)):
    """Delete a project and all associated revisions/documents."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    db.delete(project)
    db.commit()
    return {"status": "success", "message": f"Project {project_id} deleted."}


@router.post("/{project_id}/fork", response_model=ProjectDetail)
def fork_project_endpoint(project_id: str, new_target_role: str, db: Session = Depends(get_db)):
    """
    Branch an existing master resume into a new tailored variant targeting another company or role.
    """
    source = db.query(Project).filter(Project.id == project_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source project not found.")

    forked_project = Project(
        title=f"{source.title} (Tailored for {new_target_role})",
        target_role=new_target_role,
        job_description="",
        writing_style=source.writing_style,
        supporting_facts=source.supporting_facts,
    )
    db.add(forked_project)
    db.commit()
    db.refresh(forked_project)

    if source.documents:
        source_doc = source.documents[0]
        forked_doc = ResumeDocument(
            project_id=forked_project.id,
            filename=source_doc.filename,
            file_type=source_doc.file_type,
            raw_text=source_doc.raw_text,
            sections_json=source_doc.sections_json,
            enhanced_bullets_json=getattr(source_doc, "enhanced_bullets_json", "[]"),
        )
        db.add(forked_doc)
        db.commit()
        db.refresh(forked_project)

    try:
        sections = json.loads(forked_project.documents[0].sections_json) if forked_project.documents else []
    except Exception:
        sections = []

    try:
        enhanced_bullets = json.loads(forked_project.documents[0].enhanced_bullets_json) if forked_project.documents and hasattr(forked_project.documents[0], "enhanced_bullets_json") else []
    except Exception:
        enhanced_bullets = []

    return ProjectDetail(
        id=forked_project.id,
        title=forked_project.title,
        target_role=forked_project.target_role,
        job_description=forked_project.job_description,
        writing_style=forked_project.writing_style,
        supporting_facts=forked_project.supporting_facts,
        filename=forked_project.documents[0].filename if forked_project.documents else "resume.txt",
        raw_text=forked_project.documents[0].raw_text if forked_project.documents else "",
        sections=sections,
        enhanced_bullets=enhanced_bullets,
        revisions=[],
        created_at=forked_project.created_at.isoformat(),
        updated_at=forked_project.updated_at.isoformat(),
    )


@router.post("/{project_id}/revisions", response_model=BulletRevisionItem)
def record_revision_endpoint(
    project_id: str,
    bullet_id: str,
    section_title: str,
    original_text: str,
    current_text: str,
    status_val: str = "accepted",
    decision_reason: str = None,
    ats_delta: float = 0.0,
    variation_angle: str = None,
    db: Session = Depends(get_db)
):
    """Log an audit entry for a bullet edit or review decision."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    rev = BulletRevision(
        project_id=project.id,
        bullet_id=bullet_id,
        section_title=section_title,
        original_text=original_text,
        current_text=current_text,
        status=status_val,
        decision_reason=decision_reason,
        ats_delta=ats_delta,
        variation_angle=variation_angle,
    )
    db.add(rev)
    db.commit()
    db.refresh(rev)

    return BulletRevisionItem(
        id=rev.id,
        bullet_id=rev.bullet_id,
        section_title=rev.section_title,
        original_text=rev.original_text,
        current_text=rev.current_text,
        status=rev.status,
        decision_reason=rev.decision_reason,
        ats_delta=rev.ats_delta,
        variation_angle=rev.variation_angle,
        created_at=rev.created_at.isoformat(),
    )


@router.post("/{project_id}/snapshot")
def create_snapshot_endpoint(project_id: str, request: SnapshotCreateRequest, db: Session = Depends(get_db)):
    """Save a named checkpoint of the entire session state."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    snap = ProjectSnapshot(
        project_id=project.id,
        name=request.name,
        state_json=request.state_json,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return {"status": "success", "snapshot_id": snap.id, "created_at": snap.created_at.isoformat()}
