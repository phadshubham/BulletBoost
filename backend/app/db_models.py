from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    """Represents a resume enhancement project/session targeting a specific role or company."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False, default="Untitled Resume")
    target_role = Column(String(255), nullable=False, default="")
    job_description = Column(Text, nullable=False, default="")
    writing_style = Column(String(50), nullable=False, default="achievement")
    supporting_facts = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    documents = relationship("ResumeDocument", back_populates="project", cascade="all, delete-orphan")
    revisions = relationship("BulletRevision", back_populates="project", cascade="all, delete-orphan")
    snapshots = relationship("ProjectSnapshot", back_populates="project", cascade="all, delete-orphan")


class ResumeDocument(Base):
    """The raw and parsed resume document attached to a project."""
    __tablename__ = "resume_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False, default="resume.txt")
    file_type = Column(String(50), nullable=False, default="pasted_text")
    raw_text = Column(Text, nullable=False, default="")
    sections_json = Column(Text, nullable=False, default="[]")
    enhanced_bullets_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="documents")


class BulletRevision(Base):
    """Audit log tracking every edit, AI proposal, status change, and ATS score impact."""
    __tablename__ = "bullet_revisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    bullet_id = Column(String(100), nullable=False)
    section_title = Column(String(255), nullable=False, default="")
    original_text = Column(Text, nullable=False)
    current_text = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, accepted, rejected, no_suggestion
    decision_reason = Column(String(100), nullable=True)
    ats_delta = Column(Float, nullable=True, default=0.0)
    variation_angle = Column(String(50), nullable=True)  # xyz, executive, technical
    created_at = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="revisions")


class ProjectSnapshot(Base):
    """Point-in-time snapshot of the entire project state for undo/restore."""
    __tablename__ = "project_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False, default="Checkpoint")
    state_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="snapshots")
