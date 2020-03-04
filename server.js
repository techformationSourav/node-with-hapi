const Hapi = require("hapi");
const Joi = require("joi");
const server = new Hapi.Server();

// Add Connection
server.connection({
  port: 8000,
  host: "localhost"
});

server.register(
  {
    register: require("hapi-plugin-pg"),
    options: {
      connectionString: "postgres://postgres:123456@localhost:5432/testdb"
    }
  },
  err => {
    if (err) {
      throw err;
    }
  }
);

// Routes
server.route({
  method: "GET",
  path: "/",
  handler: (req, res) => {
    res.view("index");
  }
});

server.route({
  method: "GET",
  path: "/api/users",
  handler: (req, res) => {
    const params = req.query;
    let name = params.name;
    let surname = params.surname;

    if (!name && !surname) {
      name = "";
      surname = "";
    }

    const fetch_users_query = {
      // give the query a unique name
      name: "fetch-users",
      text: 'SELECT * FROM  "User" WHERE name ILIKE $1 OR surname ILIKE $2',
      values: [`%${name}%`, `%${surname}%`]
    };

    req.pg.client
      .query(fetch_users_query)
      .then(result => {
        res.view(
          "user",
          {
            users: result.rows || []
          },
          {
            layout: "index"
          }
        );
      })
      .catch(e => console.error(e.stack));
  }
});

server.route({
  method: "GET",
  path: "/api/projects",
  handler: (req, res) => {
    const params = req.query;
    let name = params.name;

    if (!name) {
      name = "";
    }
    const fetch_projects_query = {
      // give the query a unique name
      name: "fetch-projects",
      text: 'SELECT * FROM  "Project" WHERE name ILIKE $1',
      values: [`%${name}%`]
    };

    req.pg.client.query(fetch_projects_query).then(async result => {
      let user_data = [];
      await req.pg.client.query('SELECT * FROM "User"').then(user_res => {
        user_data = user_res.rows;
      });

      res.view(
        "project",
        {
          projects: {
            project_data: result.rows || [],
            user_data: user_data || []
          }
        },
        {
          layout: "index"
        }
      );
    });
  }
});

server.route({
  method: "GET",
  path: "/api/tasks",
  handler: async (req, res) => {
    const params = req.query;
    let name = params.name;
    let description = params.description;
    let status = params.status;
    let score = params.score;
    let user_id = params.user_id;

    if (!name && !description && !status && !score && !user_id) {
      name = "";
      description = "";
      status = "";
      score = null;
      user_id = null;
    }

    const fetch_tasks_query = {
      // give the query a unique name
      name: "fetch-tasks",
      text:
        'SELECT * FROM "Task" WHERE name ILIKE $1 OR description ILIKE $2 OR score = $3 OR user_id = $4 OR status ILIKE ($5) ',
      values: [`%${name}%`, `%${description}%`, score, user_id, status]
    };

    await req.pg.client.query(fetch_tasks_query).then(async result => {
      let projects_data = [];
      await req.pg.client
        .query('SELECT * FROM "Project"')
        .then(project_data => {
          projects_data = project_data.rows;
        });

      let user_data = [];
      await req.pg.client.query('SELECT * FROM "User"').then(user_res => {
        user_data = user_res.rows;
      });

      res.view(
        "task",
        {
          tasks: {
            tasks_data: result.rows || [],
            projects_data: projects_data || [],
            user_data: user_data || []
          }
        },
        {
          layout: "index"
        }
      );
    });
  }
});

server.route({
  method: "POST",
  path: "/api/users",
  handler: (req, res) => {
    const params = req.payload;

    let name = params.name;
    let email = params.email;
    let surname = params.surname;

    if (name && surname && email) {
      req.pg.client.query(
        'INSERT into "User" (name, email, surname) VALUES($1, $2, $3)',
        [`${name}`, `${email}`, `${surname}`],
        (err, result) => {
          if (err) {
            return res(err).code(500);
          }
        }
      );
    }
    res.redirect().location("users");
  }
});

server.route({
  method: "POST",
  path: "/api/projects",
  handler: (req, res) => {
    const params = req.payload;

    let name = params.name;
    let body = params.body;
    let status = params.status;
    let user_id = params.user_id;

    if (name && body && status) {
      req.pg.client.query(
        'INSERT into "Project" (name, body, status, user_id) VALUES($1, $2, $3, $4)',
        [name, body, status, user_id],
        (err, result) => {
          if (err) {
            return res(err).code(500);
          }
        }
      );
    }
    res.redirect().location("projects");
  }
});

server.route({
  method: "POST",
  path: "/api/tasks",
  config: {
    handler: (req, res) => {
      const params = req.payload;

      let name = params.name;
      let description = params.description;
      let score = params.score;
      let status = params.status;
      let user_id = params.user_id;
      let project_id = params.project_id;

      if (name && description && score && status) {
        req.pg.client.query(
          'INSERT into "Task" (name, description, score, status, user_id, project_id) VALUES($1, $2, $3, $4, $5, $6)',
          [name, description, score, status, user_id, project_id],
          (err, result) => {
            if (err) {
              return res(err).code(500);
            }
          }
        );
      }
      res.redirect().location("tasks");
    },
    validate: {
      payload: {
        name: Joi.string().required()
      }
    }
  }
});

// Vision Template
server.register(require("vision"), err => {
  if (err) {
    throw err;
  }

  server.views({
    engines: {
      html: require("handlebars")
    },
    path: __dirname + "/views"
  });
});

// Start Server
server.start(err => {
  if (err) throw err;

  console.log(`Server start at: ${server.info.uri}`);
});
