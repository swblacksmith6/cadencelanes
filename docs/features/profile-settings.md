# Profile and settings

## Purpose
One place for the signed-in coach to see who they are signed in as, change display settings and log out.

## Behaviour
- The top bar on every screen has a round avatar with the user's initials (`initials()` in `Profile.jsx`). It opens `/profile`. The old Log out button and the Phone/Desktop switch no longer sit in the top bar.
- `/profile` is open to head and assistant coaches (inside the coach `Layout`). It shows name, role and club from the stored login user. The phone number is not shown because the login response does not include it.
- Settings:
  - **Text size**: Small, Normal or Large. Sets the root font size to 14, 16 or 18 px, so the whole app scales (the layout uses rem). Saved on the device in `localStorage` key `text_size` and applied at start in `main.jsx` (`utils/textSize.js`).
  - **Layout**: Phone or Desktop. Only shown on screens 768 px or wider; a phone-width screen always uses the phone layout (see architecture.md, UI modes). Saved in `ui_mode`.
- Log out clears the token and user and goes to `/login`.
- All settings are per device. Nothing is stored on the server and there is no backend change.

## Where it lives
Frontend: `pages/Profile.jsx`, `utils/textSize.js`, avatar links in `components/Layout.jsx`, route in `App.jsx`.
Tests: `pages/Profile.test.jsx`, `components/Layout.test.jsx`, `utils/textSize.test.js`.

## Gotchas
- Super admin has its own pages (`/admin`) and does not use this screen.
- Editing the name or phone is not possible yet; it would need a backend endpoint.
