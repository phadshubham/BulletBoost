"""
BulletBoost - Automated Resume Delivery via Resend
Integrates with the Resend Email API (https://resend.com) to automatically draft
and deliver optimized resumes (.docx) as email attachments.
"""

import logging
from typing import Dict, Any, Optional, Tuple
import resend
from ..config import settings

logger = logging.getLogger(__name__)


def draft_email_content(
    target_role: Optional[str] = None,
    filename: Optional[str] = None,
    custom_message: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Builds a professional email subject and HTML message body.
    """
    role_label = target_role.strip() if target_role and target_role.strip() else "Professional"
    subject = f"Optimized Resume Application — {role_label}"

    safe_filename = filename or "enhanced_resume.docx"
    extra_note = f"<p style='margin: 16px 0; font-size: 14px; color: #374151;'>{custom_message}</p>" if custom_message else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: #1b4332; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0; letter-spacing: -0.02em;">BulletBoost — Resume Optimization</h1>
        </div>
        <div style="padding: 28px 24px;">
          <h2 style="font-size: 17px; font-weight: 600; color: #111827; margin-top: 0;">Attached: Optimized Resume for {role_label}</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
            Hello,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
            Attached to this email is an optimized copy of the candidate resume, enhanced for the <strong>{role_label}</strong> role.
          </p>
          {extra_note}
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
            <p style="font-size: 13px; font-weight: 600; color: #166534; margin: 0 0 4px 0;">Attachment Details:</p>
            <p style="font-size: 13px; color: #15803d; margin: 0;">
              📄 <strong>{safe_filename}</strong> — Formatted Microsoft Word (.docx) Document
            </p>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 24px; border-top: 1px solid #f3f4f6; pt: 16px;">
            Generated and delivered via BulletBoost — AI-Powered Resume Enhancement & ATS Precision.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    return subject, html_content


def send_resume_via_resend(
    recipient: str,
    doc_bytes: bytes,
    filename: str,
    subject: Optional[str] = None,
    custom_message: Optional[str] = None,
    target_role: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Sends the enhanced resume as an attachment to recipient via Resend API.
    Handles unconfigured API keys and API network errors gracefully.
    """
    api_key = settings.RESEND_API_KEY
    if not api_key or not api_key.strip():
        logger.warning("RESEND_API_KEY is not set in environment.")
        return {
            "status": "api_key_missing",
            "message": "Resend API key is not configured. Please set the RESEND_API_KEY environment variable to enable live delivery.",
            "recipient": recipient,
            "email_id": None,
        }

    resend.api_key = api_key

    auto_subject, auto_html = draft_email_content(
        target_role=target_role,
        filename=filename,
        custom_message=custom_message,
    )
    final_subject = subject.strip() if subject and subject.strip() else auto_subject

    try:
        # Resend accepts attachments as a list of dicts with 'content' as list of byte ints
        params: resend.Emails.SendParams = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [recipient.strip()],
            "subject": final_subject,
            "html": auto_html,
            "attachments": [
                {
                    "filename": filename,
                    "content": list(doc_bytes),
                }
            ],
        }

        response = resend.Emails.send(params)
        email_id = getattr(response, "id", None) or (response.get("id") if isinstance(response, dict) else str(response))

        logger.info(f"Successfully sent resume email to {recipient} via Resend. ID: {email_id}")
        return {
            "status": "success",
            "message": f"Resume successfully sent to {recipient} via Resend!",
            "email_id": str(email_id),
            "recipient": recipient,
        }
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Failed to send email via Resend: {err_msg}", exc_info=True)
        if "only send testing emails to your own email address" in err_msg:
            friendly_msg = (
                f"Resend Sandbox Restriction: Because this application is currently using Resend's default test sender (onboarding@resend.dev), "
                f"Resend only delivers emails to your registered Resend account address. "
                f"To send directly to recruiter addresses (like {recipient}), please verify your own domain in your Resend dashboard at https://resend.com/domains."
            )
            return {
                "status": "error",
                "message": friendly_msg,
                "recipient": recipient,
                "email_id": None,
            }
        return {
            "status": "error",
            "message": f"Failed to send email via Resend: {err_msg}",
            "recipient": recipient,
            "email_id": None,
        }
