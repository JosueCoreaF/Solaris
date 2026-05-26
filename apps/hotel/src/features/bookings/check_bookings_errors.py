import re

filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\features\bookings\Bookings.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Let's find any occurrences of getOnlyDate(something?) and change to something ? getOnlyDate(something) : ''
# or just change to getOnlyDate(something) if it has ?.
# Wait, getOnlyDate is safe to accept undefined or null.
# So getOnlyDate(cancelModalData.reserva.check_in?) is invalid syntax. It should be getOnlyDate(cancelModalData.reserva.check_in)
# Let's see all matches of getOnlyDate(expr?) or similar.

print("Occurrences of getOnlyDate with ?:")
for m in re.finditer(r'getOnlyDate\([^)]*\?[^)]*\)', content):
    print(m.group(0))

# Replace getOnlyDate(expr?.member?) or getOnlyDate(expr?) with getOnlyDate(expr)
new_content = content
new_content = re.sub(r'getOnlyDate\(([^?)]+)\?\)', r'getOnlyDate(\1)', new_content)
# Let's also check for getOnlyDate(expr?.member) - that's valid optional chaining, e.g. getOnlyDate(a?.b)
# But wait, getOnlyDate(a?.b) is completely valid in JS/TS!
# It's only getOnlyDate(a?) that is invalid syntax.

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Repaired!")
