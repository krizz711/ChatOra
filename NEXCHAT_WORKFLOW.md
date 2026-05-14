# NexChat Improvement Workflow

This workflow is for moving NexChat from a working prototype into a faster, cleaner, privacy-first ephemeral chat product.

## Current Diagnosis

NexChat already has the foundations:

- React/Vite client with Socket.io real-time messaging.
- Node/Express server with Supabase, Redis presence, JWT auth, and Cloudinary uploads.
- Private messaging, group rooms, online users, profile editing, avatars, and starring.
- Design reference exports under `client/frontend/stitch_modern_mobile_chat_application/`.

The main issues to fix now:

- Product direction is inconsistent: the concept says ephemeral communication, but room messages are currently stored in Supabase.
- The active users experience exists but is buried as `Popular Chatters`, not a first-class active-user tab.
- Profile pages show basic fields but do not feel complete enough for identity-driven retention.
- UI polish is uneven, with broken characters in some labels/icons and inconsistent formatting.
- Performance can lag because presence, stars, room lists, messages, and UI updates are not organized into a clear interaction model.
- Figma/design work should happen before large UI rewrites so the app does not get redesigned by guesswork.

## Product Decision

Chosen direction: hybrid ephemeral with stored DMs.

- Private DMs are stored so users can continue important 1-to-1 conversations.
- Room messages keep short TTL history, starting with 30 minutes.
- Expiring rooms can later set their room lifetime separately from the message TTL.
- The product promise should be updated from "no message storage" to "short-lived room history, persistent identity, and saved DMs."

Database direction:

- Add `messages.expires_at`.
- Query only non-expired room messages.
- Opportunistically delete expired room messages on room join/send.
- Add `private_messages` for stored DMs.
- Keep private message delivery real-time through Socket.io.

## Phase 1: Stabilize And Audit

Goal: make the current app reliable enough to redesign.

Tasks:

- Fix broken text/icon rendering in README, UI labels, and server logs.
- Confirm whether the app stores room messages permanently or with expiration.
- Add the hybrid ephemeral migration:
  - room messages expire after 30 minutes.
  - DMs are stored in `private_messages`.
- Add a simple performance checklist:
  - Time from send click to message appearing locally.
  - Time from socket connect to online users appearing.
  - Time to switch rooms.
  - Message list render time with 100 messages.
- Review socket events:
  - `users:online`
  - `users:list`
  - `room:join`
  - `message:send`
  - `private:send`
- Add visible error states for failed upload, failed send, offline recipient, and failed room join.

Acceptance criteria:

- No broken symbols in the visible UI.
- Room switching and private chat opening feel immediate.
- User can understand what happened when an action fails.

## Phase 2: Figma And UX System

Goal: design the actual app shell before rewriting UI.

Use the existing exported references:

- `active_people_light`
- `chat_rooms_light`
- `message_thread_light`
- `my_profile_light`
- `login_guest_access_light`
- `aetheric_messenger/DESIGN.md`

Create these Figma frames:

- Desktop chat shell: left navigation, center chat, right details/active users.
- Mobile chat shell: bottom tabs for Rooms, Active, Chat, Profile.
- Active users tab:
  - Search.
  - Online now.
  - Nearest users.
  - Most starred.
  - Gender filter.
  - Profile quick view.
- Room discovery:
  - Public rooms.
  - Private invite rooms.
  - Expiring rooms.
  - Most starred rooms.
- Full profile:
  - Avatar.
  - Username.
  - Bio.
  - Location.
  - Gender.
  - Age range or age, depending on privacy policy.
  - Star count.
  - Rooms joined.
  - Joined date.
  - Online status.
  - Guest/account status.
  - Actions: message, star, report/block later.

Design rules:

- Keep chat as the first screen, not a landing page.
- Make active users a primary navigation item.
- Keep rooms and users visually separate.
- Use compact operational UI, not marketing-style cards everywhere.
- Use icons for repeated actions like profile, star, send, attach, close, download.
- Avoid nested cards.

Acceptance criteria:

- Every main flow has desktop and mobile frames.
- The active users tab is clearly visible.
- Profile has enough persistent identity to support retention without relying on saved chat history.

## Phase 3: Immediate UI/UX Fixes

Goal: make the existing app feel correct before adding large features.

Frontend tasks:

- Rename `Popular Chatters` to `Active Users`.
- Add tabs or segmented controls in the sidebar:
  - Rooms
  - Active
  - Discover
- Add user filters:
  - Search by username.
  - Location.
  - Popularity.
  - Gender.
- Add a profile preview action from each active user row.
- Make the private chat header show:
  - Avatar.
  - Username.
  - Online status.
  - Star count.
  - Profile button.
- Replace broken emoji/icon text with stable icon components or plain ASCII labels.
- Clean up mobile layout so the sidebar is not just stacked above chat.

Backend/API tasks:

- Ensure online user payload includes all filter fields:
  - `country`
  - `state`
  - `gender`
  - `age`
  - `star_count`
  - `avatar_url`
- Add room metadata needed by the UI:
  - member count.
  - room type.
  - star count.
  - expires at.

Acceptance criteria:

- A user can find an online person, view profile, star them, and start a DM in under three clicks.
- The profile view contains all currently stored user information.
- Mobile users can navigate without scrolling through every section first.

## Phase 4: Profile As Retention

Goal: make identity persistent while chats stay temporary.

Profile fields:

- Username.
- Avatar.
- Bio.
- Country and state/region.
- Gender.
- Age or age range.
- Star count.
- Rooms joined.
- Public badges later.
- Account type: guest or registered.
- Member since.
- Last active or online now.

Profile features:

- View another user's profile from active users and private chat.
- Star/unstar from profile.
- Message from profile.
- Show public room participation, but not message history.
- Add privacy controls later:
  - hide age.
  - hide location.
  - block users.

Acceptance criteria:

- User identity feels worth returning to even when messages disappear.
- Profile does not expose sensitive information without a clear privacy choice.

## Phase 5: Ephemeral Growth Features

Goal: build the features that make NexChat distinct.

Priority order:

1. Guest access by room link.
   - Join without signup.
   - Temporary guest identity.
   - Upgrade guest to account.

2. Shareable room links.
   - Public room URL.
   - Private invite URL.
   - Copy/share action.

3. Expiring rooms.
   - Room duration on create.
   - Visible countdown.
   - Auto-delete or archive at expiry.

4. Temporary polls.
   - Text-only poll inside rooms.
   - Expiry timer.
   - Results disappear with room.

5. Ephemeral whiteboard.
   - Real-time drawing.
   - Room-scoped.
   - No persistence after room expiry.

Acceptance criteria:

- A guest can join a shared room link and chat within 10 seconds.
- Users understand when a room expires.
- Expiring content matches the privacy-first promise.

## Phase 6: Performance And State Cleanup

Goal: remove lag and make real-time interactions feel modern.

Frontend:

- Split socket state by domain:
  - presence.
  - rooms.
  - active chat.
  - private messages.
- Avoid refetching stars for every full user list update.
- Optimistically render outgoing messages.
- Memoize large user lists and message rows.
- Virtualize long message lists if room history remains.
- Debounce search and filters.
- Keep only active room messages in hot render state.

Backend:

- Avoid broadcasting full online user lists too often.
- Send incremental presence updates when possible.
- Add Redis TTL for guest sessions and expiring room state.
- Add rate limits for room create, message send, file upload, and star toggles.
- Add indexes for room messages, memberships, stars, and room discovery.

Acceptance criteria:

- Sending a message feels instant locally.
- Active user list updates do not freeze the UI.
- Switching rooms does not rerender unrelated private chat state.

## Phase 7: Quality Gate

Before calling the redesign complete:

- Run client build.
- Run server startup locally.
- Test desktop and mobile responsive views.
- Test guest login, normal login, logout.
- Test private DM text and image.
- Test room text, GIF, and blocked image behavior if rooms remain text-only.
- Test active user filters.
- Test profile view/edit.
- Test starring from active list, private chat, and profile.
- Test room expiry behavior.
- Test invite/share links.

## Suggested First Sprint

Sprint 1 should be small and visible:

1. Fix broken character rendering in visible UI.
2. Convert sidebar into clear tabs: Rooms, Active, Discover.
3. Rename and promote active users.
4. Add active user search and filters.
5. Expand profile display and profile actions.
6. Decide and document the ephemeral storage model.

This gives NexChat a clearer product shape before deeper features like expiring rooms, guest viral links, polls, and whiteboard work begin.
