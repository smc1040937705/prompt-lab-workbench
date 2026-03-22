<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { ElMessage } from "element-plus";
import { useTaskStore } from "@/store/modules/tasks";
import { useUserStore } from "@/store/modules/user";
import type { TaskSortKey } from "@/utils/task";
import type { TaskFilter, TaskItem } from "@/types/task";
import { calculateTaskRisk } from "@/utils/workflow";

const taskStore = useTaskStore();
const userStore = useUserStore();

const filterForm = reactive<TaskFilter>({
  status: "all",
  priority: "all",
  assignee: "",
  keyword: "",
  includeArchived: false,
  overdueOnly: false,
  sprint: ""
});

watch(
  filterForm,
  () => {
    taskStore.setFilter({ ...filterForm });
  },
  { deep: true, immediate: true }
);

const workload = computed(() => taskStore.workloadByAssignee);

function updateSortBy(value: TaskSortKey): void {
  taskStore.setSortBy(value);
}

function onSortChange(value: string | number | boolean): void {
  const allowed: TaskSortKey[] = ["priority", "dueDate", "status", "title", "risk", "updatedAt"];
  const next = String(value) as TaskSortKey;
  if (allowed.includes(next)) {
    updateSortBy(next);
  }
}

function markDone(task: TaskItem): void {
  if (task.status === "in_progress") {
    const reviewDecision = taskStore.transitionTask(task.id, "review", {
      actorId: userStore.profile?.id ?? "guest",
      actorRole: userStore.role,
      note: "Auto move to review before done."
    });
    if (!reviewDecision.allowed) {
      ElMessage.warning(reviewDecision.reason ?? "Cannot move task to review.");
      return;
    }
  }

  const decision = taskStore.transitionTask(task.id, "done", {
    actorId: userStore.profile?.id ?? "guest",
    actorRole: userStore.role,
    reviewer: task.reviewer ?? userStore.displayName,
    note: "Marked as done from board action."
  });
  if (!decision.allowed) {
    ElMessage.warning(decision.reason ?? "Transition not allowed.");
  }
}

function moveToReview(task: TaskItem): void {
  const result = taskStore.setTaskStatus(task.id, "review");
  if (!result) {
    ElMessage.warning("Unable to move task to review.");
  }
}

function setBlocked(task: TaskItem): void {
  taskStore.setTaskBlockedReason(task.id, "External dependency pending.");
  const decision = taskStore.transitionTask(task.id, "blocked", {
    actorId: userStore.profile?.id ?? "guest",
    actorRole: userStore.role,
    note: "Blocked by dependency."
  });
  if (!decision.allowed) {
    ElMessage.warning(decision.reason ?? "Failed to set blocked.");
  }
}

function archive(task: TaskItem): void {
  taskStore.archiveTask(task.id);
}

function addDemoTask(): void {
  taskStore.addTask({
    title: `New task ${Date.now().toString().slice(-4)}`,
    description: "Quickly created from board action for iteration planning.",
    assignee: taskStore.assigneeList[0] ?? "Lina",
    dueDate: "2026-04-05",
    priority: "medium",
    status: "todo",
    tags: ["quick-create"],
    estimateHours: 4,
    sprint: taskStore.sprintList[0] ?? "Sprint-13"
  });
}

function applySelection(rows: unknown[]): void {
  const selected = rows as TaskItem[];
  taskStore.selectTasks(selected.map((row) => row.id));
}

function bulkArchive(): void {
  const count = taskStore.bulkArchive();
  ElMessage.success(`Archived ${count} tasks.`);
}

function clearDone(): void {
  const count = taskStore.clearDone();
  ElMessage.info(`Removed ${count} done tasks.`);
}

function riskTagType(task: TaskItem): "success" | "warning" | "danger" | "info" {
  const level = calculateTaskRisk(task).level;
  if (level === "critical") {
    return "danger";
  }
  if (level === "high") {
    return "warning";
  }
  if (level === "medium") {
    return "info";
  }
  return "success";
}
</script>

<template>
  <section class="task-page">
    <header class="task-header">
      <div>
        <h2 class="page-title">Task Board</h2>
        <p class="page-description">
          Workflow transitions, bulk operations, risk sorting, and sprint filtering.
        </p>
      </div>
      <el-space>
        <el-button type="primary" @click="addDemoTask">New Task</el-button>
        <el-button :disabled="taskStore.selectedTaskIds.length === 0" @click="bulkArchive">
          Archive Selected
        </el-button>
        <el-button @click="clearDone">Clear Done</el-button>
      </el-space>
    </header>

    <el-form class="filter-grid" inline>
      <el-form-item label="Status">
        <el-select v-model="filterForm.status" style="width: 140px">
          <el-option label="All" value="all" />
          <el-option label="Todo" value="todo" />
          <el-option label="In Progress" value="in_progress" />
          <el-option label="Review" value="review" />
          <el-option label="Blocked" value="blocked" />
          <el-option label="Done" value="done" />
        </el-select>
      </el-form-item>
      <el-form-item label="Priority">
        <el-select v-model="filterForm.priority" style="width: 140px">
          <el-option label="All" value="all" />
          <el-option label="Low" value="low" />
          <el-option label="Medium" value="medium" />
          <el-option label="High" value="high" />
          <el-option label="Urgent" value="urgent" />
        </el-select>
      </el-form-item>
      <el-form-item label="Assignee">
        <el-select v-model="filterForm.assignee" clearable style="width: 140px">
          <el-option
            v-for="name in taskStore.assigneeList"
            :key="name"
            :label="name"
            :value="name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Sprint">
        <el-select v-model="filterForm.sprint" clearable style="width: 120px">
          <el-option
            v-for="item in taskStore.sprintList"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Keyword">
        <el-input v-model="filterForm.keyword" placeholder="title/desc/tag" />
      </el-form-item>
      <el-form-item label="Sort">
        <el-select
          :model-value="taskStore.sortBy"
          style="width: 140px"
          @change="onSortChange"
        >
          <el-option label="Priority" value="priority" />
          <el-option label="Due Date" value="dueDate" />
          <el-option label="Status" value="status" />
          <el-option label="Title" value="title" />
          <el-option label="Risk" value="risk" />
          <el-option label="Updated" value="updatedAt" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="filterForm.includeArchived">Include archived</el-checkbox>
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="filterForm.overdueOnly">Overdue only</el-checkbox>
      </el-form-item>
    </el-form>

    <el-table
      :data="taskStore.visibleTasks"
      row-key="id"
      class="task-table"
      @selection-change="applySelection"
    >
      <el-table-column type="selection" width="42" />
      <el-table-column prop="title" label="Task" min-width="220" />
      <el-table-column prop="assignee" label="Assignee" width="120" />
      <el-table-column prop="priority" label="Priority" width="96" />
      <el-table-column prop="status" label="Status" width="120" />
      <el-table-column label="Risk" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="riskTagType(row)">
            {{ calculateTaskRisk(row).level }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="dueDate" label="Due" width="120" />
      <el-table-column label="Actions" width="300">
        <template #default="{ row }">
          <el-space :size="2" wrap>
            <el-button size="small" text @click="markDone(row)">Done</el-button>
            <el-button size="small" text @click="moveToReview(row)">Review</el-button>
            <el-button size="small" text @click="setBlocked(row)">Block</el-button>
            <el-button size="small" text type="warning" @click="archive(row)">Archive</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <el-card shadow="never">
      <template #header>Workload by Assignee (remaining hours)</template>
      <div class="workload-wrap">
        <el-tag v-for="(hours, name) in workload" :key="name" effect="plain">
          {{ name }}: {{ hours }}h
        </el-tag>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.task-page {
  display: grid;
  gap: 0.9rem;
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.filter-grid {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 0.8rem 0.8rem 0.2rem;
}

.task-table {
  border-radius: 12px;
  overflow: hidden;
}

.workload-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
