% Test script for bandvalueExtraction function

% Sampling frequency
Fs = 1024; 

% Time vector
t = (0:1/Fs:1-1/Fs)'; 

% Construct test signals
% First column: 50 Hz and 500 Hz combined
% Second column: 100 Hz and 500 Hz combined
x = [sin(2*pi*50*t) + sin(2*pi*500*t), sin(2*pi*100*t) + sin(2*pi*500*t)];

% Frequency range
freqrange = [490, 510]; % Extract energy around 500 Hz

% Call the bandvalueExtraction function
bandvalue = bandvalueExtraction(x, Fs, freqrange);

% Display the results
disp('Band value extraction results:');
disp(bandvalue);

% % Visualize the spectrum (optional)
% N = size(x,1);
% yfft = abs(fft(detrend(x,0)));
% yfft = yfft(1:N/2+1,:)/(N/2);
% xfft = (0:N/2)'/Fs*N;

% figure;
% plot(xfft, yfft(:,1), 'r', xfft, yfft(:,2), 'b');
% xlabel('Frequency (Hz)');
% ylabel('Amplitude');
% legend('Signal 1', 'Signal 2');
% title('Signal Spectrum');
