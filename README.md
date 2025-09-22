CSPRNG Live - Final

This release ensures:
- preview event published previewOffset (35s) before final
- previous final result is broadcast at that preview time so UI shows it 35s earlier
- robust scheduling so no round is skipped
- secure crypto RNG for samples and final

Deploy:
- unzip, git commit to repo
- push to GitHub
- Create new Web Service on Render (or Railway/Fly)
- Build: npm install
- Start: npm start
- Set ADMIN_TOKEN env in Render (recommended)
