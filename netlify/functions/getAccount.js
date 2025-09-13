export async function handler(event, context) {
    const token = "patbhaPw46ilYPnUk.a146d2417ab1d33d75ae9264ff9ba57130051b79ce47fd084e830c1c4c0b561c";
    const baseId = 'appubL83HecIIoN5T';
    const tableName = 'mainTable';
    
    const accountId = JSON.parse(event.body || "{}");
    try {
        const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableName}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();
        const account = data.records.find(acc => acc.id === accountId);

        if (account) {
            return {
                statusCode: 200,
                body: JSON.stringify(account.fields.data),
            };
        } else {
            return {
                statusCode: 404,
                body: "No Account",
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
                body: "No Account",
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
}
