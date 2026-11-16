import glob

for path in glob.glob('js/**/*.js', recursive=True) + glob.glob('*.html'):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for i, l in enumerate(f):
            if '"star"' in l or "'star'" in l or 'star-filled' in l or 'renderStars' in l or 'renderReviewStar' in l:
                print(f'{path}:{i+1}: {l.strip()[:100]}')

