---
name: notion-story-export
description: Workflow for locating, mapping, and exporting complex branching stories from Notion into full markdown files. Use when you need to download a story structure with nested branches and ensure 100% content fidelity.
---

# Notion Story Export

## Overview

This skill provides a rigorous workflow for exporting multi-chapter, branching stories from Notion into a local markdown repository. It emphasizes hierarchical accuracy and full-content extraction to prevent information loss.

## Workflow

### 1. Locate the Root Story Page
Use keywords from the user's request to search for the primary story container.
- **Tool**: `mcp_notionApi_API-post-search`
- **Action**: Search for the story title (e.g., "train adventure").
- **Verification**: Confirm the ID of the root page or the "Story" sub-page.

### 2. Map the Story Hierarchy
Recursively explore sub-pages to understand the narrative structure (Acts, Branches, Scenes).
- **Tool**: `mcp_notionApi_API-get-block-children`
- **Action**: Fetch children of the root page. Look for `child_page` block types.
- **Critical Step**: If a page is labeled as a "Branch" (e.g., "Branch 1A"), fetch its children to find the actual "Acts" or "Scenes" inside it. **Do not assume the branch page itself contains the text.**

### 3. Extract Full Content (Zero Truncation)
Ensure every piece of dialogue and description is captured.
- **Tool**: `mcp_notionApi_API-get-block-children`
- **Pagination**: If the response includes `"has_more": true`, you MUST call the tool again with the `start_cursor` to get the remaining blocks.
- **Assembly**: 
    - Iterate through all blocks.
    - Extract `plain_text` from `paragraph`, `bulleted_list_item`, `numbered_list_item`, `heading_1`, `heading_2`, `heading_3`, and `quote`.
    - Concatenate the text into a single markdown buffer.
- **Anti-Pattern**: NEVER use placeholders like `*(middle content omitted)*` or `(rest of method...)`. If you cannot fetch the content, report it as a failure.

### 4. Organize Local Repository
Mirror the Notion hierarchy in the local filesystem for clarity and maintainability.
- **Pattern**: `packages/stories/[storyName]/[branchName]/act[N].md`
- **Action**: Create subdirectories as needed using `mkdir -p`.

## Quality Standards

- **Dialogue Formatting**: Maintain character name bolding (e.g., **李杰**：) and internal monologues (e.g., **李杰（內心）**：).
- **Scene Consistency**: Cross-reference IDs to ensure Scenes 9-14 under Branch 2A are actually the content of Branch 2A, not placeholders.
- **404 Handling**: If a block is not found, check if it's a permissions issue (page not shared with the "MCP" integration) and inform the user.
