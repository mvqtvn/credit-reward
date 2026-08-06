# AI Agent Instructions for credit-reward

## Project overview
This workspace is a small static frontend site for an eco-rewards dashboard. It contains plain HTML, CSS, and minimal JavaScript under:

- `pages/dashboard/`
- `pages/signin/`
- `assests/css/`
- `assests/images/`

There is no backend code or build system present.

## What matters

- Keep the project static and browser-friendly. The site is built with simple HTML/CSS/JS and should work without server-side rendering or bundlers.
- Image paths use `/assests/images/` and should remain consistent with the current folder structure.
- The active UI is in `pages/dashboard/index.html`, `pages/dashboard/style.css`, and `pages/dashboard/script.js`.
- The sign-in page is in `pages/signin/index.html`.

## Conventions

- Use relative links inside HTML pages when referencing styles/scripts within the same folder.
- Preserve the current mobile-responsive styling and keep the layout simple.
- Do not introduce extra frameworks or packages unless the user explicitly requests them.

## When helping

- Suggest minimal changes first: fix layout, accessibility, or interactivity using the existing static site model.
- If adding features, keep them compatible with a plain HTML/CSS/JS structure.
- Avoid assuming a build tool or package manager exists.

## Notes

- `pages/leaderboard/`, `pages/rewards/`, and `pages/settings/` are currently empty.
- There is no README or documentation file in the repository.
