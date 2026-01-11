# What is this app?
We used to utilize Google sheet for the travel accounting, including splitting. In the past, I used Google Form as the Entry point. Now I try to implement an App for the Frontend part to make it prettier. 

# How do we start the app?
## Google sheet
1. Create a new sheet
2. Create and link a Google App Scripts (GAS) as the backend part. 
3. The 1st tab in the sheet is used for config. It need the rows:
    1. users
    2. categories
    3. currencies 
    4. startday
4. The tabs started from 2nd need to be matched with the `users` in the config
5. Set the columns for the each user tabs
    1. timestamp

## Repo config
1. We need variables
    1. GOOGLE_APP_SCRIPT

# App structure 
## Auth

# Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
3. Run the app:
   `npm run dev`
