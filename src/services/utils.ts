export function formatTime(dateStr?: string): string {
    const date = dateStr ? new Date(dateStr) : new Date();

    return date.toLocaleTimeString('uk-UA', {
        timeZone: "Europe/Kyiv",
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function getReadableAlertType(type?: string): string {
    if (!type) return "Тривога";
    if (type === "air_raid") return "Повітряна тривога";
    if (type === "artillery_shelling") return "Загроза артобстрілу";
    if (type === "urban_figths") return "Вуличні бої";
    if (type === "chemical") return "Хімічна небезпека";
    if (type === "nuclear") return "Ядерна тривога";
    return "Тривога";
}

export function formatMessage(template: string, vars: { region: string; type: string, time: string }): string {
    return template
        .replace(/{region}/g, vars.region)
        .replace(/{type}/g, vars.type)
        .replace(/{time}/g, vars.time);
}