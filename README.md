# Cybersecurity internship portal

The Azerbaijani student portal covers six weeks with two lessons per week. Week 1, Lesson 1 starts with the original 32-slide lesson and two assignments from its homework slide. A mentor can rename the portal, program, weeks and lessons, edit lesson descriptions and material links, manage assignment text, download submissions, and leave feedback. Students can submit a text answer, a PDF/JPG/PNG attachment of up to 10 MB, or both. Each student can submit once per task.

## Preview

From this folder, run `python3 -m http.server 8000 --bind 127.0.0.1 --directory docs` and open http://127.0.0.1:8000. Use sample data in this mode. Switch between student and mentor views with the top-right button. Reloading clears the demo.

## Connect the production backend

1. Create a Supabase project. In its SQL Editor, run `backend/setup.sql`, then `backend/editable-details.sql`, once each.
2. Disable public sign-ups in Authentication. In Authentication → Users, create and confirm one account for yourself and one account per student. Use unique passwords and deliver credentials privately. Account creation and password resets are managed by the project administrator.
3. For each account, get its UUID from the Users list. Add it to the roster in the SQL Editor using the appropriate role. Run this statement once per account, replacing both placeholders where appropriate.

   ```sql
   insert into public.members (id, role)
   values ('<auth-user-uuid>', 'student');
   -- Use 'mentor' for the instructor account.
   ```

4. Put the Supabase project URL and publishable key in `docs/config.js`. This file is delivered to browsers. Use the publishable key only. The schema enforces roster membership, separates student records, and keeps the upload bucket private.

## Upgrade an existing backend

Run `backend/editable-details.sql` before replacing the website files. If your database still uses the original one-lesson schema, run `backend/add-lessons.sql` first. Existing tasks move to Lesson 1 of their current week and their submissions stay linked.

## Edit as a mentor

Use **Portal ayarları** for the portal and program names. Select a week or lesson and use **Həftəni redaktə et** or **Dərsi redaktə et**. A lesson can link to an HTTPS resource, including a file hosted elsewhere. Leave the link blank in Week 1, Lesson 1 to use the bundled slides. Select **Materialı gizlət** to hide the material from the lesson page. A resource's access permissions are managed where the resource is hosted. Use **Redaktə et** on an assignment to update its title and instructions while keeping existing submissions.

Live changes are saved in Supabase and visible to students when they open or refresh the portal. Demo edits reset on reload.

## Publish on GitHub Pages

Create a GitHub repository and commit `docs/`, `backend/` and this README. In **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/docs`. The Day 1 slide deck is a public static asset on a standard GitHub Pages site. Student records and files are stored in Supabase. Keep the original Kahoot workbook with mentor materials because it contains the answer key.

Before sharing the link, create two test student accounts and a mentor account. Check that a student can submit and see feedback, the mentor can publish a task and review the work, and the second student can see only their own submissions. The frontend preview does not exercise the live backend.
