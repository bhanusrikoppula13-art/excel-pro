const neo4j = require("neo4j-driver");

let cachedDriver;

function getDriver() {
    if (cachedDriver) {
        return cachedDriver;
    }

    const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

    if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
        throw new Error("Missing Neo4j environment variables.");
    }

    cachedDriver = neo4j.driver(
        NEO4J_URI,
        neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
    );

    return cachedDriver;
}

function normalizeValue(value) {
    if (neo4j.isInt(value)) {
        return value.toNumber();
    }

    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }

    if (value && typeof value === "object") {
        if (typeof value.toString === "function" && value.constructor && value.constructor.name === "Date") {
            return value.toString();
        }

        const normalized = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            normalized[key] = normalizeValue(nestedValue);
        }
        return normalized;
    }

    return value;
}

module.exports = async (req, res) => {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const session = getDriver().session();

    try {
        const result = await session.run(
            `
            MATCH (d:Dataset {datasetId: $datasetId})-[:HAS_ROW]->(r:Row)
            RETURN r
            ORDER BY r.rowNumber
            `,
            { datasetId: "D1" }
        );

        const rows = result.records.map((record) => {
            const node = record.get("r");
            return normalizeValue(node.properties);
        });

        return res.status(200).json(rows);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
};
