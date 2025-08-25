# Lemons Search

A fast fuzzy finder based quick switcher with preview.

The plugin adds a new quick switchers to make finding the files you want even easier and faster.
The quick switchers lets you easily search all files in your vault and offers a quick preview of the selected search result.

![exampleImage](https://raw.githubusercontent.com/mProjectsCode/obsidian-lemons-search-plugin/master/exampleImage.png)

To ensure top performance and high-quality results, the plugin is written in Rust using the [nucleo-matcher](https://crates.io/crates/nucleo-matcher) create running in a web worker.
This ensures that the majority of the computational load is taken off the main thread for a smoother feel.

## Commands

- `Lemons Search: Open search` A quick switcher that lets you all files in your vault by file path.
- `Lemons Search: Open alias search` A quick switcher that lets you all files in your vault by file names and aliases.
- `Lemons Search: Command palette` A command palette.

## Special Search Commands

Every query consists of search atoms separated by spaces. Spaces can be escaped using `\`.
In the following illustration, each underlined part is a separate search atom.

```
movie Star\ Wars
----- ----------
```

Search atoms can be modified using special characters to change their behavior.

- **Substring**: prefix with `'`
    - will require search results to contain the search atom as a continuous sequence
    - e.g. `'foo` will only match `yummy food` but not `funny doodle`
    - use `!` to negate, e.g. `!foo`
- **Prefix**: prefix with `^`
    - will require search results to have the search atom as a prefix
    - e.g. `^foo` will only match `food` but not `yummy food`
    - use `!^` to negate, e.g. `!^foo`
- **Postfix**: postfix with `$`
    - will require search results to have the search atom as a postfix
    - e.g. `.md$` will only match `foo.md` but not `foo.txt`
    - use `!<search atom>$` to negate, e.g. `!.md$`
- **Exact**: prefix with `^` and postfix with `$`
    - will require search results to equal the search atom
    - e.g. `^foo.md$` will **only** match `foo.md` and nothing else
    - use `!^<search atom>$` to negate, e.g. `!^foo.md$`

Lower case search atoms will ignore casing, but as soon as a search atom contains an upper case letter, it becomes case sensitive.

## Keyboard Navigation

While the input field is focused, you can use the following keyboard short-cuts.

- `↑` Move selection up by one
- `↓` Move selection down by one
- `Home` Move selection to the first item
- `End` Move selection to the last item
- `Enter` Open selection in same tab
- `Ctrl + Enter` Open selection in a new Tab
- `Tab` Copy the current selection into the search bar
- `Escape` Cancel the search

Some of these short-cuts can be configures in the plugin's settings.

## Mouse Navigation

- Clicking on a suggestion that is not selected will select the clicked suggestion
- Clicking on the selected suggestion will open the suggestion in the same tab
- Ctrl-clicking on the selected suggestion will open the suggestion in a new tab
