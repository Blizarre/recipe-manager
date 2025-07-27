import re
from typing import Dict, List, Tuple, Optional
from fastapi import HTTPException
import datetime

class RecipeValidator:
    """Validates and formats recipe markdown content"""
    
    REQUIRED_SECTIONS = [
        "# ",  # Recipe Title
        "## Ingredients",
        "## Instructions", 
        "## Notes"
    ]
    
    TEMPLATE = """# Recipe Title

## Ingredients

- 

## Instructions

1. 

## Notes

"""

    def __init__(self):
        pass
    
    def get_template(self, title: str = "New Recipe") -> str:
        """Get a recipe template with optional title"""
        template = self.TEMPLATE.replace("Recipe Title", title)
        return template
    
    def validate_recipe(self, content: str) -> Tuple[bool, List[str]]:
        """
        Validate a recipe's markdown structure
        Returns (is_valid, list_of_errors)
        """
        errors = []
        
        # Check for required sections
        for section in self.REQUIRED_SECTIONS:
            if section not in content:
                if section == "# ":
                    errors.append("Recipe must have a title (line starting with '# ')")
                else:
                    errors.append(f"Missing required section: {section}")
        
        # Validate ingredients section format
        ingredients_errors = self._validate_ingredients_section(content)
        errors.extend(ingredients_errors)
        
        # Validate instructions section format  
        instructions_errors = self._validate_instructions_section(content)
        errors.extend(instructions_errors)
        
        return len(errors) == 0, errors
    
    def _validate_ingredients_section(self, content: str) -> List[str]:
        """Validate that ingredients use bullet points"""
        errors = []
        
        # Find ingredients section
        ingredients_match = re.search(r'## Ingredients\s*\n(.*?)(?=## |\Z)', content, re.DOTALL)
        if not ingredients_match:
            return errors  # Section missing error will be caught elsewhere
        
        ingredients_section = ingredients_match.group(1).strip()
        if not ingredients_section:
            errors.append("Ingredients section cannot be empty")
            return errors
        
        # Check that ingredients use bullet points (- or *)
        lines = [line.strip() for line in ingredients_section.split('\n') if line.strip()]
        for line in lines:
            if not (line.startswith('- ') or line.startswith('* ')):
                errors.append(f"Ingredients must use bullet points (- or *): '{line}'")
        
        return errors
    
    def _validate_instructions_section(self, content: str) -> List[str]:
        """Validate that instructions use numbered lists"""
        errors = []
        
        # Find instructions section
        instructions_match = re.search(r'## Instructions\s*\n(.*?)(?=## |\Z)', content, re.DOTALL)
        if not instructions_match:
            return errors  # Section missing error will be caught elsewhere
        
        instructions_section = instructions_match.group(1).strip()
        if not instructions_section:
            errors.append("Instructions section cannot be empty")
            return errors
        
        # Check that instructions use numbered lists
        lines = [line.strip() for line in instructions_section.split('\n') if line.strip()]
        for i, line in enumerate(lines, 1):
            if not re.match(r'^\d+\. ', line):
                errors.append(f"Instructions must use numbered lists (1. 2. 3. etc.): '{line}'")
        
        return errors
    
    def auto_populate_template(self, filename: str) -> str:
        """Auto-populate template based on filename"""
        # Extract recipe name from filename
        name = filename.replace('.md', '').replace('_', ' ').replace('-', ' ')
        name = ' '.join(word.capitalize() for word in name.split())
        
        return self.get_template(name)
    
    def format_recipe(self, content: str) -> str:
        """Format and clean up recipe content"""
        # Add creation date if not present
        if "Created:" not in content and "## Notes" in content:
            date_str = datetime.datetime.now().strftime("%Y-%m-%d")
            content = content.replace(
                "## Notes",
                f"## Notes\n\nCreated: {date_str}"
            )
        
        return content
    
    def extract_recipe_info(self, content: str) -> Dict[str, str]:
        """Extract basic recipe information"""
        info = {
            "title": "",
            "ingredients_count": 0,
            "instructions_count": 0
        }
        
        # Extract title
        title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
        if title_match:
            info["title"] = title_match.group(1).strip()
        
        # Count ingredients
        ingredients_match = re.search(r'## Ingredients\s*\n(.*?)(?=## |\Z)', content, re.DOTALL)
        if ingredients_match:
            ingredients_section = ingredients_match.group(1).strip()
            ingredients_lines = [line for line in ingredients_section.split('\n') 
                               if line.strip() and (line.strip().startswith('- ') or line.strip().startswith('* '))]
            info["ingredients_count"] = len(ingredients_lines)
        
        # Count instructions
        instructions_match = re.search(r'## Instructions\s*\n(.*?)(?=## |\Z)', content, re.DOTALL)
        if instructions_match:
            instructions_section = instructions_match.group(1).strip()
            instructions_lines = [line for line in instructions_section.split('\n') 
                                if line.strip() and re.match(r'^\d+\. ', line.strip())]
            info["instructions_count"] = len(instructions_lines)
        
        return info