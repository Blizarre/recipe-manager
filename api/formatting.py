"""Recipe formatting via the LLM."""

from .llm import chat_completion

FORMATTING_PROMPT = """
Reformat the following recipe text into a standard markdown recipe structure.

Output exactly this structure:
# Title

## Ingredients

- ingredient 1
- ingredient 2

## Instructions

1. Step one
2. Step two

## Notes

Any notes here (leave this section empty if there are no notes)

Rules:
- Preserve all measurements and quantities exactly as written
- Write instructions as linear, numbered steps
- Do not invent or remove any information
- Return only the raw markdown content, no code fences or extra commentary

Recipe text to reformat:
{content}
"""


async def format_recipe_markdown(content: str) -> str:
    """Reformat unstructured recipe content into standard markdown.

    Raises:
        ValueError: If content is empty.
        LLMError: If the LLM request fails.
    """
    if not content or not content.strip():
        raise ValueError("Content cannot be empty")

    return await chat_completion(FORMATTING_PROMPT.format(content=content))
