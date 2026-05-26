filepath = r"c:\Users\Zyros RK\Desktop\PartnerCentral-Frontend\src\components\AsistenteAI.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "update" in line.lower() or "reserva" in line.lower() or "edit" in line.lower():
        print(f"Line {i}: {line.strip()}")
