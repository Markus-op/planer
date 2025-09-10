export async function handler(event, context) {
    const token = "patbhaPw46ilYPnUk.a146d2417ab1d33d75ae9264ff9ba57130051b79ce47fd084e830c1c4c0b561c";
    const baseId = 'appubL83HecIIoN5T';
    const tableName = 'mainTable';
    const accountId = JSON.parse(event.body || "{}");
    fetch(`https://api.airtable.com/v0/${baseId}/${tableName}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
        .then(response => response.json())
        .then(data => {
            const accounts = data.records;
            for (let index = 0; index < accounts.length; index++) {
                const account = accounts[index]; //find account
                if (account.id == accountId) {
                    return {
                        statusCode: 200,
                        body: JSON.stringify(account.data),
                    };
                }
            }
            return {
                statusCode: 404,
                body: "No Account"
            }
        })
        .catch(error => {
            return {
                statusCode: 404,
                body: error
            }
        });

}
