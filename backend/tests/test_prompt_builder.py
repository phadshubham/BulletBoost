from backend.app.models import SelectedBullet
from backend.app.services.prompt_builder import (
    build_enhancement_prompt,
    build_corrective_prompt,
    SYSTEM_PROMPT,
)


def test_2_correct_prompt_construction():
    """Scenario 2: System and user prompts incorporate target role, style, and instructions."""
    bullets = [
        SelectedBullet(
            id="bullet_exp_1",
            text="Developed web features in React.",
            section_title="Experience",
            section_type="experience",
        )
    ]
    messages = build_enhancement_prompt(
        bullets=bullets,
        target_role="Senior Frontend Architect",
        job_description="Seeking expert React and TypeScript architect.",
        writing_style="technical",
        supporting_facts="Led design system migration.",
    )

    assert len(messages) == 2
    system_msg = messages[0]["content"]
    user_msg = messages[1]["content"]

    # Verify anti-hallucination rules in system prompt
    assert "NEVER INVENT NUMBERS OR METRICS" in system_msg
    assert "NEVER INVENT TECHNOLOGIES" in system_msg
    assert "PRESERVE FACTUAL INTEGRITY" in system_msg

    # Verify user inputs in user message
    assert "Senior Frontend Architect" in user_msg
    assert "technical" in user_msg
    assert "Seeking expert React and TypeScript architect." in user_msg
    assert "Led design system migration." in user_msg


def test_3_selected_bullets_only_are_sent():
    """Scenario 3: Only bullets passed into the function appear in the constructed payload."""
    all_bullets = [
        SelectedBullet(id="b1", text="Bullet One", section_title="Exp"),
        SelectedBullet(id="b2", text="Bullet Two", section_title="Exp"),
    ]
    # Simulate user selecting only b2
    selected_only = [all_bullets[1]]

    messages = build_enhancement_prompt(
        bullets=selected_only,
        target_role="Software Engineer",
    )
    user_msg = messages[1]["content"]

    assert "b2" in user_msg
    assert "Bullet Two" in user_msg
    assert "b1" not in user_msg
    assert "Bullet One" not in user_msg


def test_4_source_facts_and_bullet_ids_preserved():
    """Scenario 4: Bullet IDs and exact text are preserved in prompt."""
    bullets = [
        SelectedBullet(id="custom_id_999", text="Exact original text 123", section_title="Projects"),
    ]
    messages = build_enhancement_prompt(
        bullets=bullets,
        target_role="Data Engineer",
    )
    user_msg = messages[1]["content"]

    assert "custom_id_999" in user_msg
    assert "Exact original text 123" in user_msg


def test_corrective_prompt_retry():
    """Verify corrective prompt structure for JSON repair."""
    orig = [{"role": "system", "content": "sys"}, {"role": "user", "content": "usr"}]
    retry = build_corrective_prompt(orig, "Expecting property name enclosed in double quotes")

    assert len(retry) == 3
    assert "valid JSON" in retry[2]["content"]
