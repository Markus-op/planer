export async function handler(event, context) {
    const token = "patbhaPw46ilYPnUk.a146d2417ab1d33d75ae9264ff9ba57130051b79ce47fd084e830c1c4c0b561c"; // besser über Env
    const baseId = 'appubL83HecIIoN5T';
    const tableName = 'mainTable';
    
    let manager;
    try {
        manager = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Ungültiges JSON" }) };
    }

    const body = {
        records: [
            {
                fields: {
                    data: JSON.stringify(manager)
                }
            }
        ]
    };

    try {
        // POST
        const postResponse = await fetch(`https://api.airtable.com/v0/${baseId}/${tableName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const postResult = await postResponse.json();
        if (!postResponse.ok) {
            console.error('Airtable Fehler:', postResult);
            return { statusCode: 500, body: JSON.stringify({ error: "Airtable POST fehlgeschlagen" }) };
        }

        // GET
        const getResponse = await fetch(`https://api.airtable.com/v0/${baseId}/${tableName}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const getData = await getResponse.json();
        const lastAccount = getData.records[getData.records.length - 1];

        return {
            statusCode: 200,
            body: lastAccount.id // id des zuletzt hinzugefügten Accounts
        };

    } catch (error) {
        console.error('Netzwerkfehler:', error);
        return { statusCode: 500, body: JSON.stringify({ error: "Netzwerkfehler" }) };
    }
}
