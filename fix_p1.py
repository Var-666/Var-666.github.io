import re

filepath = '/Users/var/Desktop/网页/src/components/MusicPlayer.vue'

with open(filepath, 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i < 1220:
        new_lines.append(line)
    else:
        # Priority 1: Fix invisible text in dark tray
        line = line.replace('color: var(--color-text)', 'color: var(--c-text-inv)')
        line = line.replace('color: var(--color-ink)', 'color: var(--c-text-inv)')
        line = line.replace('color: var(--color-text-light)', 'color: var(--c-text-inv-2)')
        line = line.replace('color: var(--color-text-lighter)', 'color: var(--c-text-inv-2)')
        line = line.replace('color: var(--color-text-muted)', 'color: var(--c-text-inv-2)')
        new_lines.append(line)

with open(filepath, 'w') as f:
    f.writelines(new_lines)
