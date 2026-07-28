# Role Title and Employer Name replace Job Label

Status: accepted

Pack completeness and Resume Export filenames need a stable role + company pair from the first successful review. A single combined **Job Label** string forced parsing (`Role - Company`) for spreadsheets and made employer names containing ` - ` ambiguous. Review now mints two frozen fields — **Role Title** and **Employer Name** — stored separately. Legacy `job-label.txt` values split on the first ` - ` when read; new reviews write `role-title.txt` and `employer-name.txt` only. Export filenames stay `{name} CV {Role Title} - {Employer Name}`.

**Rejected:** keeping Job Label as the stored mint; requiring re-review to migrate existing jobs; splitting only at write time without read-time legacy support.
