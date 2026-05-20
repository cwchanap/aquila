import json
import sys

def process_notion_json(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    results = data.get('results', [])
    markdown_lines = []
    
    for block in results:
        block_type = block.get('type')
        if block_type in ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote']:
            rich_text = block.get(block_type, {}).get('rich_text', [])
            line = ""
            for rt in rich_text:
                text = rt.get('plain_text', '')
                if rt.get('annotations', {}).get('bold'):
                    text = f"**{text}**"
                # Add other annotations if needed, but the instructions focus on bolding names
                line += text
            
            if block_type == 'heading_1':
                line = f"# {line}"
            elif block_type == 'heading_2':
                line = f"## {line}"
            elif block_type == 'heading_3':
                line = f"### {line}"
            elif block_type == 'bulleted_list_item':
                line = f"- {line}"
            elif block_type == 'numbered_list_item':
                line = f"1. {line}"
            elif block_type == 'quote':
                line = f"> {line}"
            
            markdown_lines.append(line)
        elif block_type == 'divider':
            markdown_lines.append("---")
    
    return "\n\n".join(markdown_lines)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_notion.py <file_path>")
        sys.exit(1)
    print(process_notion_json(sys.argv[1]))
