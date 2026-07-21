#!/usr/bin/env python3

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEBSITES = ROOT / "websites"
PAGES = ROOT / "_pages"

PAGES.mkdir(exist_ok=True)

projects = []

for folder in sorted(WEBSITES.iterdir()):
    if not folder.is_dir():
        continue

    if not (folder / "index.html").exists():
        continue

    name = folder.name

    # Nice title
    title = name.replace("-", " ").replace("_", " ").title()

    # Optional description
    description = ""
    desc_file = folder / "description.txt"
    if desc_file.exists():
        description = desc_file.read_text().strip()

    projects.append({
        "name": name,
        "title": title,
        "description": description,
    })

########################################################################
# Generate landing page
########################################################################

landing = PAGES / "websites.md"

body = """---
layout: page
title: Websites
permalink: /websites/
nav: true
nav_order: 8
---

"""

for p in projects:

    body += f"""
## [{p['title']}]({{{{ '/websites/{p['name']}/' | relative_url }}}})

{p['description']}

[Open →]({{{{ '/websites/{p['name']}/' | relative_url }}}})

---
"""

landing.write_text(body)

print(f"Generated page for {len(projects)} websites.")
