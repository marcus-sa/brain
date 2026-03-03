export const SURREALQL_SYNTAX_REFERENCE = `
## SurrealQL Syntax Reference

### SELECT Statement
\`\`\`
SELECT [ VALUE ] @fields [ AS @alias ] [ OMIT @fields ]
  FROM [ ONLY ] @targets
  [ WITH [ NOINDEX | INDEX @indexes ... ] ]
  [ WHERE @conditions ]
  [ SPLIT [ ON ] @field, ... ]
  [ GROUP [ BY ] @field, ... ]
  [ ORDER [ BY ] @field [ COLLATE ] [ NUMERIC ] [ ASC | DESC ], ... | RAND() ]
  [ LIMIT @number [ START @start ] ]
  [ FETCH @fields ... ]
  [ TIMEOUT @duration ]
;
\`\`\`

### Graph Traversal (Arrow Syntax)
SurrealDB uses arrow syntax for graph traversal — NOT SQL JOINs.

- Forward traversal: \`->edge_table->target_table\`
- Reverse traversal: \`<-edge_table<-source_table\`
- Bidirectional: \`<->edge_table<->table\`
- Projections on traversal: \`->edge->table.{field1, field2}\`
- Multi-hop: \`->edge1->table1->edge2->table2\`

Examples:
\`\`\`sql
-- Forward: tasks belonging to a project
SELECT ->belongs_to->project FROM task;

-- Reverse: tasks that belong to a project
SELECT <-belongs_to<-task FROM project;

-- Projection: get specific fields from traversal
SELECT ->belongs_to->project.{name, status} FROM task;

-- Multi-hop: features of projects in a workspace
SELECT ->has_project->project->has_feature->feature FROM workspace;
\`\`\`

### Time Literals & Functions
Use duration literals — NOT SQL INTERVAL syntax.

Duration literals: \`1s\`, \`5m\`, \`2h\`, \`1d\`, \`1w\`, \`2w\`, \`30d\`

\`\`\`sql
-- Correct: duration literal
WHERE created_at < time::now() - 2w

-- WRONG: SQL INTERVAL (does NOT exist in SurrealQL)
-- WHERE created_at < NOW() - INTERVAL '2 weeks'
\`\`\`

Time functions:
- \`time::now()\` — current datetime
- \`time::floor(datetime, duration)\` — round down
- \`time::day(datetime)\`, \`time::month(datetime)\`, \`time::year(datetime)\`

### GROUP BY / GROUP ALL
Every non-aggregate field in the SELECT projection must appear in the GROUP BY clause. Use \`GROUP ALL\` to aggregate the entire table into a single row.

\`\`\`sql
-- Group by single field
SELECT status, count() AS total FROM task GROUP BY status;

-- Group by multiple fields
SELECT gender, country, city FROM person GROUP BY gender, country, city;

-- GROUP ALL: aggregate entire table
SELECT count() AS total FROM task GROUP ALL;

-- Unique values from nested arrays across all records
SELECT array::group(tags) AS tags FROM article GROUP ALL;
\`\`\`

### Aggregate Functions
- \`count()\` — count rows in group
- \`math::sum(expr)\` — sum values
- \`math::mean(expr)\` — average
- \`math::min(expr)\`, \`math::max(expr)\`
- \`math::stddev(expr)\` — standard deviation
- \`math::variance(expr)\` — variance
- \`array::len(array)\` — array length

### Useful Built-in Functions
- \`record::table(id)\` — get table name from a record ID
- \`record::id(id)\` — get the ID portion of a record ID
- \`array::flatten(array)\` — flatten nested arrays
- \`array::distinct(array)\` — unique values
- \`array::len(array)\` — array length
- \`string::lowercase(str)\`, \`string::contains(str, substr)\`
- \`type::is::record(value)\` — check if value is a record

### WHERE Clause
Supports boolean logic, graph edge conditions, numeric ranges, and nested array filtering.

\`\`\`sql
-- Boolean logic
SELECT * FROM user WHERE (admin AND active) OR owner = true;

-- Filter based on graph edge count
SELECT * FROM profile WHERE count(->experience->organisation) > 3;

-- Filter on graph edge properties
SELECT * FROM person WHERE ->(reaction WHERE type = 'celebrate')->post;

-- Numeric range (faster than two comparisons)
SELECT * FROM person WHERE age IN 18..=65;

-- Filter nested array values
SELECT address[WHERE active = true] FROM person;

-- Truthy check (present and not empty)
SELECT name FROM person WHERE name;
\`\`\`

### SPLIT Clause
SPLIT expands array fields so each element becomes a separate row. Useful for analyzing individual items within array fields.

**SPLIT and GROUP BY are incompatible** — they cannot be used together (parsing error since v3.0.0). Use one or the other.

\`\`\`sql
-- Split the results by each value in an array
SELECT * FROM user SPLIT emails;
\`\`\`

### WITH Clause (Index Hints)
WITH forces the query planner to use a specific index (or no index). Use \`NOINDEX\` to force a full table scan when index cardinality is high and scanning would be faster than multiple index lookups.

\`\`\`sql
-- Force a specific index
SELECT * FROM task WITH INDEX idx_task_status WHERE status = 'open';

-- Force full table scan (skip index)
SELECT * FROM task WITH NOINDEX WHERE status = 'open';
\`\`\`

### FETCH Clause
FETCH retrieves related records from other tables in a single query, resolving record links or graph edges inline.

\`\`\`sql
-- Fetch related posts for each person
SELECT * FROM person FETCH posts;

-- Fetch specific relation
SELECT *, ->belongs_to->project AS project FROM task FETCH project;
\`\`\`

### LET Variables
Use LET to store intermediate results and reuse them across statements.

\`\`\`sql
LET $cutoff = time::now() - 2w;
SELECT * FROM decision WHERE created_at < $cutoff AND status = 'provisional';
\`\`\`

### IF ELSE
IF ELSE can be used as a standalone statement or inline within a parent statement to return a value. Supports multiple ELSE IF branches with no limit.

\`\`\`
IF @condition { @expression; .. }
  [ ELSE IF @condition { @expression; .. } ] ...
  [ ELSE { @expression; .. } ]
\`\`\`

\`\`\`sql
-- Standalone: conditional query
IF count(SELECT * FROM task WHERE status = 'blocked') > 0 {
  SELECT * FROM task WHERE status = 'blocked';
} ELSE {
  SELECT 'No blocked tasks' AS message;
};

-- Inline: computed field
SELECT title,
  IF status = 'open' { 'active' }
  ELSE IF status = 'blocked' { 'at risk' }
  ELSE { 'done' }
  AS category
FROM task;
\`\`\`

### FOR Loop
Iterate over array values or integer ranges.

\`\`\`
FOR @item IN @iterable { @block };
\`\`\`

\`\`\`sql
-- Iterate over an array
FOR $name IN ['Alpha', 'Beta'] {
  CREATE type::record('project', $name) CONTENT { name: $name };
};

-- Iterate over an integer range (inclusive)
FOR $i IN 0..=10 {
  CREATE type::record('batch', $i) CONTENT { index: $i };
};
\`\`\`

**Limitations:** Variables declared outside a FOR loop can be read inside the loop but NOT modified (assignment operators are only allowed in SET and DUPLICATE KEY UPDATE clauses). Use \`array::fold\` or \`array::reduce\` for accumulation instead.

### RETURN Statement
RETURN returns an implicit value or query result. Use it to set the return value for a transaction, block, or function.

\`\`\`sql
-- Return a computed value
LET $open = (SELECT count() AS total FROM task WHERE status = 'open' GROUP ALL);
LET $closed = (SELECT count() AS total FROM task WHERE status = 'closed' GROUP ALL);
RETURN { open: $open[0].total, closed: $closed[0].total };
\`\`\`

### Important Rules
1. Always include a \`LIMIT\` clause (default to 100 if not specified by user intent)
2. ORDER BY fields must appear in the SELECT projection
3. LIMIT must come before FETCH
4. Use \`$param\` syntax for parameterized values
5. For TYPE RELATION tables, edges are created with RELATE — they have \`in\` and \`out\` fields
6. \`IS NOT NONE\` checks for field existence (not \`IS NOT NULL\`)

### DO NOT USE (SQL constructs that do NOT exist in SurrealQL)
- \`JOIN\` — use arrow traversal instead
- \`INTERVAL\` — use duration literals (2w, 1d, etc.)
- \`HAVING\` — use WHERE with GROUP BY
- \`COALESCE\` / \`IFNULL\` — not available
- Subqueries in SELECT list — use LET variables instead
- \`LIMIT N OFFSET M\` — use \`LIMIT @number START @start\` instead
- \`AS\` for table aliases — not supported
- \`UNION\` / \`INTERSECT\` — use array functions or multiple queries
`;
