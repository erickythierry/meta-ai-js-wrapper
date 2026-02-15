export interface MetaAIConstructorArgs {
    fbEmail?: string;
    fbPassword?: string;
    proxy?: any; // strict proxy types can be complex, using any for now or AxiosProxyConfig
}

export interface Media {
    url: string;
    type: string;
    prompt?: string;
}

export interface Source {
    [key: string]: any; // Structure depends on Meta's response
}

export interface MetaAIResponse {
    message: string;
    sources: Source[];
    media: Media[];
}

export interface Cookies {
    datr: string;
    rd_challenge?: string;
    // Campos legados (mantidos para compatibilidade, mas não usados no novo fluxo)
    _js_datr?: string;
    abra_csrf?: string;
    lsd?: string;
    fb_dtsg?: string;
    abra_sess?: string;
    [key: string]: string | undefined;
}
