import re
import sys

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Priority 2
    content = content.replace('var(--color-warm)', 'var(--c-warm)')

    # Priority 3
    content = content.replace('border-radius: 28px', 'border-radius: var(--r-full)')
    content = content.replace('border-radius: 24px', 'border-radius: var(--r-lg)')
    content = content.replace('border-radius: 18px', 'border-radius: var(--r-lg)')
    content = content.replace('border-radius: 20px', 'border-radius: var(--r-lg)')
    content = content.replace('border-radius: 10px', 'border-radius: var(--r-md)')
    content = content.replace('border-radius: 8px', 'border-radius: var(--r-sm)')
    content = content.replace('border-radius: 3px', 'border-radius: var(--r-xs)')
    content = content.replace('border-radius: 2px', 'border-radius: var(--r-xs)')
    
    content = content.replace('var(--radius-full)', 'var(--r-full)')
    content = content.replace('var(--radius-xs)', 'var(--r-sm)')
    content = content.replace('var(--radius-sm)', 'var(--r-md)')
    content = content.replace('var(--radius)', 'var(--r-md)')
    
    # Priority 4: font-sizes
    fs_map = {
        '0.58rem': 'var(--fs-xs)',
        '0.6rem': 'var(--fs-xs)',
        '0.62rem': 'var(--fs-xs)',
        '0.65rem': 'var(--fs-xs)',
        '0.68rem': 'var(--fs-xs)',
        '0.7rem': 'var(--fs-xs)',
        '0.72rem': 'var(--fs-xs)',
        '0.75rem': 'var(--fs-xs)',
        '0.76rem': 'var(--fs-xs)',
        '0.78rem': 'var(--fs-xs)',
        '0.8rem': 'var(--fs-sm)',
        '0.82rem': 'var(--fs-sm)',
        '0.84rem': 'var(--fs-sm)',
        '0.85rem': 'var(--fs-sm)',
        '0.88rem': 'var(--fs-body)',
        '0.9rem': 'var(--fs-body)',
        '0.92rem': 'var(--fs-body)',
        '0.95rem': 'var(--fs-body)',
        '0.96rem': 'var(--fs-body)',
        '1.05rem': 'var(--fs-h3)',
        '1.1rem': 'var(--fs-h3)',
        '1.15rem': 'var(--fs-h3)',
        '1.25rem': 'var(--fs-h3)',
    }
    
    for old_fs, new_fs in fs_map.items():
        content = content.replace(f'font-size: {old_fs}', f'font-size: {new_fs}')

    with open(filepath, 'w') as f:
        f.write(content)

process_file('/Users/var/Desktop/网页/src/components/MusicPlayer.vue')
