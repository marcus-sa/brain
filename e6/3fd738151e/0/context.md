# Session Context

## User Prompts

### Prompt 1

<system_instruction>
You are working inside Conductor, a Mac app that lets the user run many coding agents in parallel.
Your work should take place in the /Users/marcus/conductor/workspaces/brain/montevideo-v1 directory (unless otherwise directed), which has been set up for you to work in.
Each workspace has a .context directory (gitignored) where you can save files to collaborate with other agents.
The target branch for this workspace is main. Use this for actions like creating new PRs, bise...

### Prompt 2

syntax clauses:
[ ORDER [ BY ] 
	@field [ COLLATE ] [ NUMERIC ] [ ASC | DESC ], ...
	| RAND() ]
]

`SPLIT [ON] @field`

STATEMENT
    [WHERE condition;]

[ WITH [ NOINDEX | INDEX @indexes ... ]]

OMIT @fields FROM @table

LIMIT @number [START @start 0]


GROUP BY @fields


STATEMENT
    [FROM [ONLY] @targets;]

The FETCH clause is used to retrieve related records or data from other tables in a single query. This is particularly useful when you want to gather data that is linked through relati...

### Prompt 3

update the analytics agent’s syntax reference

### Prompt 4

The SPLIT clause in SurrealQL is used to split the results of a query based on a specific field, particularly when dealing with arrays. This is useful in scenarios where you want to treat each element of an array as a separate row in the result set. It can be particularly helpful in data analysis contexts where you need to work with individual elements of an array separately.

The WITH clause is used to replace the default table iterator with an index iterator. In cases where the cardinality ...

### Prompt 5

The IF ELSE statement can be used as a main statement, or within a parent statement, to return a value depending on whether a condition, or a series of conditions match. The statement allows for multiple ELSE IF expressions, and a final ELSE expression, with no limit to the number of ELSE IF conditional expressions.

### Prompt 6

commit

