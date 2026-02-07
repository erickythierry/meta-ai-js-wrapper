export enum ActionType {
    CREATE_FILE = "CREATE_FILE",
    RUN_COMMAND = "RUN_COMMAND",
    READ_FILE = "READ_FILE",
    PLAN = "PLAN",
    UNKNOWN = "UNKNOWN",
}

export interface ActionRequest {
    type: ActionType;
    params: Record<string, string>;
    raw: string;
}

export interface AgentResult {
    success: boolean;
    message: string;
    data?: any;
}

export interface AgentConfig {
    name: string;
    description: string;
    actionTypes: ActionType[];
}

export type PlanStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface PlanStep {
    index: number;
    description: string;
    action: ActionRequest;
    status: PlanStepStatus;
}

export interface Plan {
    description: string;
    steps: PlanStep[];
}
