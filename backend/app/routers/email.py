from fastapi import APIRouter, HTTPException, status
from ..models import SendResumeEmailRequest, SendResumeEmailResponse
from ..services.exporter import generate_resume_docx, sanitize_filename
from ..services.email_service import send_resume_via_resend

router = APIRouter(prefix="/api", tags=["Email & Delivery"])


@router.post("/send-resume", response_model=SendResumeEmailResponse)
def send_resume_endpoint(request: SendResumeEmailRequest):
    """
    Generate the enhanced DOCX resume and send it to the destination email via Resend.
    """
    if not request.recipient_email or "@" not in request.recipient_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid recipient email address is required.",
        )

    try:
        # Build accepted bullets map
        accepted_map = {item.bullet_id: item.text for item in request.accepted_bullets}
        safe_filename = sanitize_filename(request.filename)

        # Generate the formatted DOCX in memory (clean, no artificial title header)
        doc_bytes = generate_resume_docx(
            sections=request.sections,
            accepted_bullets_map=accepted_map,
        )

        # Dispatch via Resend API
        res = send_resume_via_resend(
            recipient=request.recipient_email,
            doc_bytes=doc_bytes,
            filename=safe_filename,
            subject=request.subject,
            custom_message=request.message,
            target_role=request.target_role,
        )

        return SendResumeEmailResponse(**res)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing resume email delivery: {str(e)}",
        )
