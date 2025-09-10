export async function handler(event, context) {
    const token = "patbhaPw46ilYPnUk.a146d2417ab1d33d75ae9264ff9ba57130051b79ce47fd084e830c1c4c0b561c";
    const baseId = 'appubL83HecIIoN5T';
    const tableName = 'mainTable';
    const manager = JSON.parse(event.body || "{}");
    const dataId = manager.dataId;
    if (!dataId) {
        return { statusCode: 400, body: JSON.stringify({ error: "dataId fehlt" }) };
    }

    const changedFields = {
        fields: {
            data: JSON.stringify(manager)
        }
    };

    try {
        await fetch(`https://api.airtable.com/v0/${baseId}/${tableName}/${dataId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(changedFields)
        });

        return {
            statusCode: 200,
            body: "{}",
        };
    } catch (error) {
        console.error('Fehler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Update fehlgeschlagen" }),
        };
    }
}
