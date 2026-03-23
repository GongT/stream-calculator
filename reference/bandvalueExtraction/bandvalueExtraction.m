function bandvalue = bandvalueExtraction(x, Fs, freqrange)
%#codegen
% Simplified band value extraction
% x: Matrix, each column is a signal
% Fs: Sampling frequency
% freqrange: A 2-element array [freqlow, frequp], representing the frequency range
% Output:
% bandvalue: Row vector, the number of elements equals the width of x, 
%            each element represents the feature value of a signal

% Example usage:
% x=mysingen(1,[16 500],1024,0,0,1,0,0);
% x = sum(x,2);
% Fs = 1024;
% freqrange = [499 501];

N = size(x,1);
yfft = abs(fft(detrend(x,0)));
yfft = yfft(1:N/2+1,:)/(N/2);
xfft=(0:N/2)'/Fs*N;
idx_start = find(xfft <= freqrange(1), 1, 'last');
idx_end   = find(xfft >= freqrange(2), 1, 'first');
bandvalue = sqrt(sum(yfft(idx_start:idx_end,:).^2))/sqrt(2);

% Uncomment the following line to visualize the spectrum
% figure;plot(xfft,yfft)
end
