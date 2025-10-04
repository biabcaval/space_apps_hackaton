from os import path
import uvicorn 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List


class fruit(BaseModel):
    name: str

class fruits(BaseModel):
    fruits: List[fruit]


app = FastAPI()


origins = [
     "http://localhost:3000"
]

# CORS: cross origin resource sharing
# prohibits unauthorized websites from acessing your api

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]

)

# database that wont persist when the database shuts down
memory_db = {
"fruits": []
}

@app.get("/fruits", response_model=fruits)

def get_fruits():
    return fruits(fruits=memory_db['fruits'])

@app.post("/fruits")

def add_fruit(fruit: fruit):
    memory_db['fruits'].append(fruit)
    print('salvou')
    return fruit


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)