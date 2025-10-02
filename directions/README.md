# Agent Work Directions

This directory contains detailed work instructions and context for AI agents working on this project.

## 📁 Current Projects

### [state-machine-fixes/](./state-machine-fixes/) - Active

**Status**: Core implementation complete, critical fixes pending
**Last Updated**: 2025-10-02
**Branch**: `remotes/origin/feature/declarative-converter`

**Quick Start**: Read [state-machine-fixes/START_HERE.md](./state-machine-fixes/START_HERE.md)

**Overview**: Event-based State Machine XML parsing implementation with Zod-like declarative API. Core refactoring complete, transforms and memory leak fixes needed.

**Priority Tasks**:
1. 🔴 Fix transform application (2-3 hours)
2. 🔴 Fix memory leak (1-2 hours)

**Test Status**:
- ✅ Basic: 25/25 pass
- ✅ Transform: 24/24 pass
- ⚠️ Complex shapes: 8/14 pass
- ❌ Large files: OOM

---

## 📋 Directory Structure Convention

Each project directory should contain:

1. **START_HERE.md** - Quick start guide (10 min read)
2. **HANDOFF_YYYYMMDD.md** - Session summaries with date
3. **README.md** - Project overview and documentation index
4. **CURRENT_STATUS.md** - Detailed status report
5. **NEXT_TASKS.md** - Prioritized task breakdown
6. **ARCHITECTURE_NOTES.md** - Technical deep dive (optional)

---

## 🔄 Version Management

- Create new `HANDOFF_YYYYMMDD.md` for each agent session
- Update `START_HERE.md` when priorities change
- Keep `CURRENT_STATUS.md` up to date with latest test results
- Archive completed projects to `archive/` subdirectory

---

## 📝 Best Practices

### For Current Agent (Finishing Work)

1. Update CURRENT_STATUS.md with findings
2. Create HANDOFF_YYYYMMDD.md with session summary
3. Update NEXT_TASKS.md (mark completed, add new issues)
4. Commit changes with descriptive message

### For Next Agent (Starting Work)

1. Read START_HERE.md first (fastest path)
2. Read latest HANDOFF_YYYYMMDD.md (full context)
3. Verify current state by running tests
4. Start with Task 1 from NEXT_TASKS.md

---

## 🎯 Template

When creating new project directories, use this template:

```
directions/[project-name]/
├── START_HERE.md              # Quick start (required)
├── HANDOFF_YYYYMMDD.md        # Session summary (required)
├── README.md                  # Overview (required)
├── CURRENT_STATUS.md          # Status report (recommended)
├── NEXT_TASKS.md              # Task breakdown (recommended)
└── ARCHITECTURE_NOTES.md      # Technical details (optional)
```

---

Last updated: 2025-10-02
