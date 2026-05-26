import re

filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace patterns like: some_expr.split('T')[0]
# where some_expr is not ending with .toISOString()
# Let's search for matches of: ([a-zA-Z0-9_?.]+)\.split\(['"]T['"]\)\[0\]

def replacer(match):
    expr = match.group(1)
    if expr.endswith("toISOString()"):
        return match.group(0) # don't change
    return f"getOnlyDate({expr})"

# Pattern: ([a-zA-Z0-9_?.()]+)\.split\(['"]T['"]\)\[0\]
new_content = re.sub(r'([a-zA-Z0-9_?.()\[\]]+)\.split\([\'"]T[\'"]\)\[0\]', replacer, content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Replacement complete!")
