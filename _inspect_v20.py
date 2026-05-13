import sys, json
with open('super_agent_cfo.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
nodes = {n['id']: n for n in d['nodes']}

out = '=== AI Agent (top-level flags) ===\n'
agent = nodes['node-agent']
out += f'continueOnFail: {agent.get("continueOnFail")}\n'
out += f'alwaysOutputData: {agent.get("alwaysOutputData")}\n'
out += f'retryOnFail: {agent.get("retryOnFail")}\n'
out += f'maxTries: {agent.get("maxTries")}\n'
out += f'waitBetweenTries: {agent.get("waitBetweenTries")}\n'

ft = nodes['node-format-telegram']
out += '\n=== Format for Telegram FULL ===\n'
out += json.dumps(ft, indent=2, ensure_ascii=False)

st = nodes['node-send-telegram']
out += '\n\n=== Send Telegram FULL ===\n'
out += json.dumps(st, indent=2, ensure_ascii=False)

# Save Conv flags too
sv = nodes['node-save-conv']
out += '\n\n=== Save Conv flags ===\n'
out += f'continueOnFail: {sv.get("continueOnFail")}\n'
out += f'alwaysOutputData: {sv.get("alwaysOutputData")}\n'

sys.stdout.buffer.write(out.encode('utf-8'))
