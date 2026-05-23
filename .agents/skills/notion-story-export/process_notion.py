import json
import os
import re
import sys
from pathlib import Path


def extract_plain_text(rich_text):
    """Extract plain text from rich_text array, preserving bold annotations."""
    parts = []
    for rt in rich_text:
        text = rt.get('plain_text', '')
        if rt.get('annotations', {}).get('bold'):
            text = f"**{text}**"
        parts.append(text)
    return ''.join(parts)


def block_to_markdown(block):
    """Convert a single Notion block to markdown line(s)."""
    block_type = block.get('type')
    if block_type in ['paragraph', 'heading_1', 'heading_2', 'heading_3',
                        'bulleted_list_item', 'numbered_list_item', 'quote']:
        rich_text = block.get(block_type, {}).get('rich_text', [])
        line = extract_plain_text(rich_text)
        if not line.strip():
            return None
        if block_type == 'heading_1':
            return f"# {line}"
        elif block_type == 'heading_2':
            return f"## {line}"
        elif block_type == 'heading_3':
            return f"### {line}"
        elif block_type == 'bulleted_list_item':
            return f"- {line}"
        elif block_type == 'numbered_list_item':
            return f"1. {line}"
        elif block_type == 'quote':
            return f"> {line}"
        return line
    elif block_type == 'divider':
        return '---'
    return None


def process_notion_json(file_path):
    """Convert a single Notion API JSON response to markdown string."""
    with open(file_path, 'r') as f:
        data = json.load(f)

    results = data.get('results', [])
    markdown_lines = []

    for block in results:
        md_line = block_to_markdown(block)
        if md_line is not None:
            markdown_lines.append(md_line)

    return '\n\n'.join(markdown_lines)


def build_tree_from_json(file_path):
    """Build a tree of child_page blocks from a Notion API JSON response."""
    with open(file_path, 'r') as f:
        data = json.load(f)

    tree = []
    for block in data.get('results', []):
        if block.get('type') == 'child_page':
            child = block.get('child_page', {})
            tree.append({
                'id': block.get('id'),
                'title': child.get('title', ''),
                'type': 'child_page',
            })
        elif block.get('type') == 'paragraph':
            rich_text = block.get('paragraph', {}).get('rich_text', [])
            line = extract_plain_text(rich_text)
            if line.strip():
                tree.append({
                    'id': block.get('id'),
                    'title': line,
                    'type': 'paragraph',
                })
    return tree


def print_tree(tree, indent=0, file=sys.stdout):
    """Pretty-print a tree structure."""
    for node in tree:
        prefix = '  ' * indent
        marker = '📄' if node.get('type') == 'child_page' else '📝'
        print(f"{prefix}{marker} {node.get('title', '')}", file=file)
        children = node.get('children', [])
        if children:
            print_tree(children, indent + 1, file=file)


def slugify(text):
    """Convert a title to a filesystem-safe slug."""
    text = text.strip()
    text = re.sub(r'[\\/:*?"<>|]', '_', text)
    text = re.sub(r'\s+', '_', text)
    return text.lower()


def parse_act_number(title):
    """Extract act number from titles like '第八幕：...' or 'Act 8: ...'."""
    match = re.search(r'第([一二三四五六七八九十百千]+)幕', title)
    if match:
        cn_nums = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
                    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
                    '十一': 11, '十二': 12, '十三': 13, '十四': 14,
                    '十五': 15, '十六': 16, '十七': 17, '十八': 18,
                    '十九': 19, '二十': 20, '二十一': 21, '二十二': 22,
                    '二十三': 23, '二十四': 24, '二十五': 25, '二十六': 26,
                    '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30}
        num_str = match.group(1)
        for cn, num in sorted(cn_nums.items(), key=lambda x: -len(x[0])):
            if num_str == cn:
                return num
    match = re.search(r'Act\s+(\d+)', title, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def get_branch_slug(title):
    """Generate a slug for a branch page, e.g. 'Branch 1A' -> 'branch_1a'."""
    match = re.search(r'Branch\s+(\w+)', title, re.IGNORECASE)
    if match:
        return f"branch_{match.group(1).lower()}"
    return slugify(title)


def get_act_slug(title):
    """Generate a slug for an act page, e.g. '終幕：...' -> 'actFinal', '尾聲：...' -> 'actEpilogue', '第八幕：...' -> 'act8'."""
    if '終幕' in title:
        return 'actFinal'
    if '尾聲' in title:
        return 'actEpilogue'
    num = parse_act_number(title)
    if num is not None:
        return f'act{num}'
    return slugify(title)


def classify_node(title):
    """Classify a node as 'branch', 'act', or 'other'."""
    if re.search(r'Branch\s+\w+', title, re.IGNORECASE):
        return 'branch'
    if re.search(r'第[一二三四五六七八九十百千]+幕', title) or re.search(r'Act\s+\d+', title, re.IGNORECASE):
        return 'act'
    return 'other'


def write_markdown_to_file(content, file_path):
    """Write markdown content to a file, creating directories if needed."""
    Path(file_path).parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

def cmd_single(file_path):
    """Usage: python process_notion.py single <file_path>"""
    print(process_notion_json(file_path))


def cmd_tree(file_path):
    """Usage: python process_notion.py tree <file_path>"""
    tree = build_tree_from_json(file_path)
    print_tree(tree)


def cmd_bulk(mapping_json, out_dir):
    """
    Bulk extract markdown from multiple Notion JSON files.

    mapping_json: path to a JSON file describing the export mapping.
    out_dir: root output directory.

    The mapping JSON format:
    [
      {
        "story": "trainAdventure",
        "branch_path": "branch_1a/branch_2b",
        "files": [
          {"json": "/path/to/act7.json", "act": "act7", "title": "第七幕：分歧的追蹤"}
        ]
      }
    ]
    """
    with open(mapping_json, 'r', encoding='utf-8') as f:
        mapping = json.load(f)

    for story in mapping:
        story_name = story['story']
        branch_path = story.get('branch_path', '')
        for item in story.get('files', []):
            json_path = item['json']
            act = item.get('act', '')
            title = item.get('title', '')

            if not os.path.exists(json_path):
                print(f"[SKIP] File not found: {json_path}")
                continue

            md_content = process_notion_json(json_path)
            if title:
                md_content = f"# {title}\n\n{md_content}"

            # Determine output filename: explicit filename > act field > auto-derived from title
            filename = item.get('filename') or item.get('act') or get_act_slug(title)
            relative_dir = os.path.join(story_name, branch_path) if branch_path else story_name
            out_file = os.path.join(out_dir, relative_dir, f"{filename}.md")
            write_markdown_to_file(md_content, out_file)
            print(f"[OK] {out_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("""
Usage:
  python process_notion.py single <file_path>          # Convert one JSON file to markdown
  python process_notion.py tree  <file_path>           # Show child_page tree from a JSON file
  python process_notion.py bulk  <mapping.json> <out>  # Bulk export from mapping file
        """)
        sys.exit(1)

    command = sys.argv[1]
    if command == 'single' and len(sys.argv) >= 3:
        cmd_single(sys.argv[2])
    elif command == 'tree' and len(sys.argv) >= 3:
        cmd_tree(sys.argv[2])
    elif command == 'bulk' and len(sys.argv) >= 4:
        cmd_bulk(sys.argv[2], sys.argv[3])
    else:
        print(f"Unknown command or missing args: {command}")
        sys.exit(1)
