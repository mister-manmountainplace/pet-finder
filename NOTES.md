After each save point, push it to GitHub.
The AI connects through getKey().
OpenAI model: gpt-5.6-luna

## Pet Finder Version 1

### What’s done
- Expo SDK 58 phone app named Pet Finder.
- Compare a missing-pet poster with a found-animal photo using the computer-side AI helper.
- Submit found-pet evidence for an AI review.
- Save found-pet reports on the phone.
- Show scam warnings and share a selected poster.
- Keep the AI key on the computer; the phone only receives AI answers.

### How to run it
1. Fill in `KEYGEN_URL` and `KEYGEN_TOKEN` in `.env`.
2. From the project folder, start the helper: `PATH="$PWD/.tools/node-v26.13.1-darwin-arm64/bin:$PATH" node server/aiHelper.js`
3. In another terminal, start Expo: `cd app && PATH="../.tools/node-v26.13.1-darwin-arm64/bin:$PATH" npx expo start --lan`
4. Scan the Expo QR code in Expo Go while the phone and computer use the same Wi-Fi.

### Maybe Later
- The user can receive automated alerts about found pets.
- The user can view a gallery of found animals in their area.
- The user can receive notifications for matches between missing and found pets.
- The user can save their missing pet’s profile for easy access.
- The user can search for missing pets by location and date.
- The user can read safety tips to avoid scams in the app.
- The user can contact local shelters for additional support.

### Next
- Test the complete flow on a phone with real photos and the helper running.
- Improve the written competition entry and short demo video after testing.
