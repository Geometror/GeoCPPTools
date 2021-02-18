# Change Log

All notable changes to the "geocpptools" extension will be documented in this file.

## [0.2.2]

### Added:
- reactivated the user prompt to choose whether the *include path resolver* should process the files as VSCode handles FileRenameEvents correctly again(since 1.53)

### Fixed:
- fixed open and modified files causing conflicts with processed files since they were not saved before the move/rename operation

## [0.2.1]

### Fixed:
- fixed wrong config cache behavior
### Removed:
- several properties which had no effect
- ability to enable an prompt to choose whether the *include path resolver* should process the files due to broken behavior in VSCode version 1.52
## [0.2.0]

### Added
- Include path resolver
## [0.1.0]

### Added 
- C++ quick class creator