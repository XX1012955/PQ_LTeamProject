from vosk import Model,KaldiRecognizer
import wave
import pyaudio
import json
from openai import OpenAI
voiceModel= Model('vosk-model-small-cn-0.22')
#实时语音识别
p=pyaudio.PyAudio()#麦克风
voiceFromP=p.open(
    format=pyaudio.paInt16,
    channels=1,
    rate=16000,
    input=True,
    frames_per_buffer=4000
)
voiceRecognizer=KaldiRecognizer(voiceModel,16000)
while True:
    recognizeData=voiceFromP.read(4000)
    if voiceRecognizer.AcceptWaveform(recognizeData):
        outputResult=voiceRecognizer.Result()
        file_path = "C:/Users/86130/Desktop/111.txt"  # 根据需要修改路径
        with open(file_path, "a", encoding="utf-8") as file:
            file.write(json.loads(outputResult)['text'].replace(' ',''))
