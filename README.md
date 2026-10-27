# Aprovaê

A grade calculator for Instituto J&F Tech students. Pick your year, type your N1 and N2 grades for each semester, and see right away whether you passed, need the final recovery exam, or failed. The page is styled after the school's own grades portal.

**Live:** https://dvarakaki.github.io/aprovae-web/

## Features

- **Year selection:** choose 1st, 2nd or 3rd year Tech. Each year has a fixed list of subjects.
- **Grade-level input:** enter N1 and N2 for each semester. The semester averages, annual average, final average and status update as you type.
- **Average-only input:** if you already know your semester averages, switch to "Média do semestre" and type them directly instead of N1 and N2. Both sets of grades are kept, so you can switch back anytime.
- **Recovery unlock:** the final recovery field stays locked until the annual average drops below 7. It then shows the grade you need to pass.
- **Clear statuses:** passed, passed in recovery (shown in its own color), in recovery, failed, and in progress.
- **Overview:** your overall average, a status breakdown, filters and search.
- **Formula simulator:** type sample grades and watch the official formulas fill in.
- **Input validation:** grades from 0 to 10 with up to two decimals. Anything above 10 is rejected as you type.
- **Saved locally:** grades are stored in your browser (`localStorage`). Nothing is sent anywhere.
- **Responsive:** a table layout on desktop and cards on mobile. Animations fall back to simple fades when "reduce motion" is on.

## Grading rules

| Measure | Formula | Pass mark |
| --- | --- | --- |
| Semester average | `(N1 + N2) / 2`, for each semester | – |
| Annual average | `(1st semester + 2nd semester × 2) / 3` | ≥ 7 |
| Final average | `(final recovery + annual average) / 2` | ≥ 6 |
| Recovered average | `(1st semester + 2nd semester) / 2`, capped at 7.00 | – |

A semester average only exists once both N1 and N2 are entered. While only the 1st semester is complete, the annual average equals the 1st semester average.

The recovered average applies when the 2nd semester grade is higher than the 1st. It then replaces the 1st semester grade in the annual average, but only when that raises the grade. Results are rounded to two decimals.

All rules live in [`src/lib/grades.ts`](src/lib/grades.ts) and are covered by tests in [`src/lib/grades.test.ts`](src/lib/grades.test.ts).

## Tech stack

- [React 19](https://react.dev) + TypeScript
- [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Lucide](https://lucide.dev) icons
- Node's built-in test runner

## Getting started

Requires Node.js 24 or newer.

```bash
npm install
npm run dev      # start the dev server
npm test         # run the grading rule tests
npm run build    # type-check and build to dist/
```

## Project structure

```
src/
├── App.tsx                  # year routing, grades view, filters and search
├── data/subjects.ts         # subject list for each year
├── lib/
│   ├── grades.ts            # grading rules
│   ├── grades.test.ts       # tests for the rules
│   └── useInView.ts         # scroll-reveal hook
└── components/
    ├── YearPicker.tsx       # year selection screen
    ├── Summary.tsx          # overall average and status breakdown
    ├── SubjectRow.tsx       # subject row (table on desktop, card on mobile)
    └── Formulas.tsx         # formula cards and simulator
```

### Adding subjects for a year

Edit [`src/data/subjects.ts`](src/data/subjects.ts) and fill in that year's array. Years with no subjects show as "coming soon" on the selection screen.

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow runs the tests, builds the site and publishes it to GitHub Pages.

## License

[MIT](LICENSE)
