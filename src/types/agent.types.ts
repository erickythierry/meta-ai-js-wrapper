export enum ActionType {
    CREATE_FILE = "CREATE_FILE",
    RUN_COMMAND = "RUN_COMMAND",
    READ_FILE = "READ_FILE",
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
