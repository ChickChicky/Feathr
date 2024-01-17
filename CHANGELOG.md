# 10/03/2023
* Started implementing extensions
* Added a background color for the text
* Swapped line and column in cursor report

# 11/03/2023
* Fixed a glitch that prevented files from saving

# 15/03/2023
* Added backet pairs coloring for NuggetScript

# 17/03/2023
* Added very basic markdown support
* Added the ability to apply multiple styles at once

# 02/07/2023
* Removed a lot of (somewhat) unrelated junk files
* Enhanced input by processing it character by character instead of with big blocks of data, meaning that newlines can actually be pasted
* Ctrl+C now also copies to the user's clipboard
* Started rewriting how extensions work
* Started rewriting commands to make them much cleaner and later make it possible for extensions to create some
* **TODO**: `controls.txt` has to be updated for the new ones