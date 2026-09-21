<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git: ask first, and never push onto a merged PR

**Ask before every commit and before opening any pull request.** Not "commit
and mention it afterwards" — ask, wait for an answer, then act. Doing the work
and leaving it staged is fine; committing it is not.

**Check the pull request is still open before pushing to its branch.** A branch
whose PR has been merged is finished: a commit pushed there lands on `main`
nowhere, appears in no open PR, and is invisible to review. When the PR is
merged, the new work belongs on a fresh branch cut from the updated `main`,
with a pull request of its own.

    # is this branch's PR still open?
    GET /repos/<owner>/<repo>/pulls/<n>   ->  state, merged
    # did a commit actually reach main?
    git merge-base --is-ancestor <sha> origin/main
