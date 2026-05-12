module.exports = {
  apps: [
    {
      name: 'meal-hook',
      script: 'index.js',
      cwd: __dirname,
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
