import json, sys
sys.stdout.reconfigure(encoding='utf-8')

# Test direct sans ambiguité de quoting shell
two_bs = "\\\\"       # 2 backslashes en valeur Python
two_bs_b = "\\\\b"   # 2 backslashes + b
slash_q = "/?"

print("two_bs  :", repr(two_bs),   "len:", len(two_bs))
print("two_bs_b:", repr(two_bs_b), "len:", len(two_bs_b))
print("slash_q :", repr(slash_q),  "len:", len(slash_q))
print()

# On veut que le JS source code ait les chars:
# \ \ b  (3 chars, ce qu'on voit dans '\\b' en JS source = word boundary)
# Python value pour cela : 2 backslashes + b
python_for_js_wboundary = "\\\\" + "b"
print("python_for_wboundary:", repr(python_for_js_wboundary), "len:", len(python_for_js_wboundary))
j = json.dumps(python_for_js_wboundary)
print("json.dumps:", j)
back = json.loads(j)
print("json.loads:", repr(back), "same:", back == python_for_js_wboundary)
print()

# Pattern complet
pattern_py = "<(?!/?(?:b|i|u|s|code|pre|a)" + "\\\\" + "b)[^>]+>"
print("pattern py:", repr(pattern_py))
j2 = json.dumps(pattern_py)
print("json.dumps:", j2)
back2 = json.loads(j2)
print("json.loads:", repr(back2))
print()

# Verifier que le JS source code sera bien :
# '<(?!/?(?:b|i|u|s|code|pre|a)\\b)[^>]+>'
# Attendu en back2 : <(?!/?(?:b|i|u|s|code|pre|a)\\b)[^>]+>
# (2 backslashes + b dans la valeur Python = les 2 chars qu'on voit dans le JS source)
expected = "<(?!/?(?:b|i|u|s|code|pre|a)" + "\\\\" + "b)[^>]+>"
assert back2 == expected, f"MISMATCH: {repr(back2)} vs {repr(expected)}"
print("OK: round-trip correct")
