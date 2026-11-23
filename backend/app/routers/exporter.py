from fastapi import APIRouter, Response, HTTPException, status
from ..models import ExportDocxRequest
from ..services.exporter import generate_resume_docx, sanitize_filename

router = APIRouter(prefix="/api", tags=["Export"])


@router.post("/export-docx")
def export_docx_endpoint(request: ExportDocxRequest):
    """
    Generate and download a real DOCX resume document.
    Preserves original sections and non-modified content, substituting
    only the user-approved bullet rewrites.
    """
    try:
        accepted_map = {item.bullet_id: item.text for item in request.accepted_bullets}
        safe_filename = sanitize_filename(request.filename)
        doc_bytes = generate_resume_docx(
            sections=request.sections,
            accepted_bullets_map=accepted_map,
        )

        return Response(
            content=doc_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate DOCX resume: {str(e)}",
        )
