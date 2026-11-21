module.exports = {
  apps: [
    {
      name: 'tpt-tasks-api',
      cwd: __dirname,
      script: '.venv/bin/uvicorn',
      args: 'main:app --host 127.0.0.1 --port 3050',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        PYTHONUNBUFFERED: '1',
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      time: true,
    },
  ],
};
